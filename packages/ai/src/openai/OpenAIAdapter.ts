import type { IPlatformHTTP } from "@arc/core/platform/IPlatformHTTP.js";
import type { ImageAttachment } from "@arc/contracts/ImageAttachment.js";
import type { IProvider, ModelInfo, ProviderCapabilities } from "@arc/contracts/IProvider.js";
import type {
  OpenAIMessage,
  OpenAIMessageContent,
  ChatCompletionRequest,
  LegacyCompletionRequest,
  ListModelsResponse,
  OpenAIModel,
} from "./types.js";
import {
  parseStreamChunk,
  extractChunkContent,
  isStreamComplete,
} from "./streaming.js";
import {
  createProviderErrorFromResponse,
  createProviderErrorFromNetworkError,
} from "./errors.js";
import { ProviderErrorCode } from "@arc/core/domain/ProviderError.js";

/**
 * OpenAI API adapter
 *
 * Provides methods for interacting with OpenAI's API:
 * - List available models
 * - Health check
 * - Stream chat completions
 */
export class OpenAIAdapter implements IProvider {
  private http: IPlatformHTTP;
  private apiKey: string;
  private baseUrl: string;
  private customHeaders: Record<string, string>;

  constructor(
    http: IPlatformHTTP,
    apiKey: string,
    baseUrl: string = "https://api.openai.com/v1",
    customHeaders: Record<string, string> = {}
  ) {
    this.http = http;
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
    this.customHeaders = customHeaders;
  }

  /**
   * Get common headers for all requests
   */
  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      ...this.customHeaders,
    };
  }

  /**
   * List available models
   */
  async listModels(): Promise<ModelInfo[]> {
    try {
      const response = await this.http.request(`${this.baseUrl}/models`, {
        method: "GET",
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw createProviderErrorFromResponse(
          response.status,
          response.body,
          response.headers
        );
      }

      const data = JSON.parse(response.body) as ListModelsResponse;
      return data.data;
    } catch (error) {
      if (error instanceof Error && error.name === "ProviderError") {
        throw error;
      }
      throw createProviderErrorFromNetworkError(error as Error);
    }
  }

  /**
   * Health check - verifies API key and connection
   *
   * @returns true if connection is healthy
   * @throws ProviderError if connection fails
   */
  async healthCheck(): Promise<boolean> {
    try {
      // List models is a lightweight endpoint to test connectivity
      await this.listModels();
      return true;
    } catch (error) {
      // Re-throw ProviderError for caller to handle
      throw error;
    }
  }

  /**
   * Get capabilities for a specific model
   *
   * @param model - Model to check capabilities for
   * @returns Provider capabilities
   */
  getCapabilities(model: string): ProviderCapabilities {
    // Vision-capable models (GPT-4V and beyond)
    const visionModels = [
      'gpt-4-vision',
      'gpt-4-turbo',
      'gpt-4o',
      'gpt-4.1',
      'gpt-4.5',
      'gpt-5',
    ];

    const supportsVision = visionModels.some(vm => model.includes(vm));

    return {
      supportsVision,
      supportsStreaming: true,
      requiresMaxTokens: false, // OpenAI has defaults
      supportedMessageRoles: ['user', 'assistant', 'system'],
    };
  }

  /**
   * Convert messages array to a prompt string for legacy completions
   */
  private messagesToPrompt(
    messages: Array<{ role: "user" | "assistant" | "system"; content: string }>
  ): string {
    return messages
      .map((msg) => {
        const roleLabel = msg.role === "system" ? "System" :
                         msg.role === "user" ? "User" : "Assistant";
        return `${roleLabel}: ${msg.content}`;
      })
      .join("\n\n") + "\n\nAssistant:";
  }

  /**
   * Stream using legacy /v1/completions endpoint
   */
  private async *streamLegacyCompletion(
    messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
    model: string,
    signal?: AbortSignal
  ): AsyncGenerator<string, void, undefined> {
    const prompt = this.messagesToPrompt(messages);

    const request: LegacyCompletionRequest = {
      model,
      prompt,
      stream: true,
      temperature: 0.7,
    };

    const requestOptions: {
      method: "POST";
      headers: Record<string, string>;
      body: string;
      signal?: AbortSignal;
    } = {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(request),
    };

    if (signal !== undefined) {
      requestOptions.signal = signal;
    }

    const stream = this.http.stream(
      `${this.baseUrl}/completions`,
      requestOptions
    );

    for await (const line of stream) {
      const chunk = parseStreamChunk(line);

      if (!chunk) {
        continue;
      }

      if (isStreamComplete(chunk)) {
        return;
      }

      const content = extractChunkContent(chunk);
      if (content) {
        yield content;
      }
    }
  }

  /**
   * Stream chat completion with auto-fallback to legacy completions
   *
   * Converts Arc's message format to OpenAI format and streams the response
   * Automatically falls back to legacy /v1/completions if chat completions fail
   *
   * @param messages - Array of messages (user/assistant/system)
   * @param model - Model to use (e.g., "gpt-4", "gpt-3.5-turbo")
   * @param attachments - Optional image attachments for the latest message
   * @param signal - AbortSignal for cancellation
   * @returns AsyncGenerator yielding content chunks
   */
  async *streamChatCompletion(
    messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
    model: string,
    attachments?: ImageAttachment[],
    signal?: AbortSignal
  ): AsyncGenerator<string, void, undefined> {
    // Convert messages to OpenAI format
    const openAIMessages: OpenAIMessage[] = messages.map((msg, index) => {
      // Add attachments to the last user message
      if (
        msg.role === "user" &&
        index === messages.length - 1 &&
        attachments &&
        attachments.length > 0
      ) {
        const content: OpenAIMessageContent[] = [
          { type: "text", text: msg.content },
          ...attachments.map((att) => ({
            type: "image_url" as const,
            image_url: {
              url: att.data, // data URL
              detail: "auto" as const,
            },
          })),
        ];
        return { role: msg.role, content };
      }

      return { role: msg.role, content: msg.content };
    });

    const request: ChatCompletionRequest = {
      model,
      messages: openAIMessages,
      stream: true,
      temperature: 0.7,
    };

    try {
      // Build request options, conditionally including signal
      const requestOptions: {
        method: "POST";
        headers: Record<string, string>;
        body: string;
        signal?: AbortSignal;
      } = {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(request),
      };

      if (signal !== undefined) {
        requestOptions.signal = signal;
      }

      const stream = this.http.stream(
        `${this.baseUrl}/chat/completions`,
        requestOptions
      );

      for await (const line of stream) {
        const chunk = parseStreamChunk(line);

        if (!chunk) {
          continue; // Skip invalid chunks
        }

        if (isStreamComplete(chunk)) {
          return; // Stream finished
        }

        const content = extractChunkContent(chunk);
        if (content) {
          yield content;
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        // Check if it's already a ProviderError
        if (error.constructor.name === "ProviderError") {
          const providerError = error as any; // Type assertion for error code access

          // Auto-fallback to legacy completions for 404 or model not found
          // Also fallback if the error mentions chat completions not being supported
          if (
            providerError.code === ProviderErrorCode.MODEL_NOT_FOUND ||
            error.message.includes("does not support chat completions") ||
            error.message.includes("404")
          ) {
            // Fallback to legacy completions (no vision support in legacy)
            if (attachments && attachments.length > 0) {
              throw new Error("Legacy completions API does not support image attachments");
            }

            yield* this.streamLegacyCompletion(messages, model, signal);
            return;
          }

          throw error;
        }

        // Handle HTTP errors from the stream
        if (error.message.includes("HTTP ")) {
          const match = error.message.match(/HTTP (\d+):/);
          if (match) {
            const status = Number.parseInt(match[1] || "500", 10);
            const body = error.message.split("\n").slice(1).join("\n");

            // Try fallback on 404
            if (status === 404) {
              if (attachments && attachments.length > 0) {
                throw new Error("Legacy completions API does not support image attachments");
              }
              yield* this.streamLegacyCompletion(messages, model, signal);
              return;
            }

            throw createProviderErrorFromResponse(status, body);
          }
        }

        // Network errors
        throw createProviderErrorFromNetworkError(error);
      }

      throw error;
    }
  }
}
