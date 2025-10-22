import type { IPlatformHTTP } from "@arc/core/platform/IPlatformHTTP.js";
import type { ImageAttachment } from "@arc/contracts/ImageAttachment.js";
import type { IProvider, ModelInfo, ProviderCapabilities } from "@arc/contracts/IProvider.js";
import type {
  AnthropicMessage,
  AnthropicContentBlock,
  MessagesRequest,
  ListModelsResponse,
} from "./types.js";
import {
  parseStreamEvent,
  extractEventContent,
  isStreamComplete,
  isErrorEvent,
} from "./streaming.js";
import {
  createProviderErrorFromResponse,
  createProviderErrorFromNetworkError,
} from "./errors.js";

/**
 * Anthropic API adapter
 *
 * Provides methods for interacting with Anthropic's Messages API:
 * - List available models (static list, Anthropic doesn't have a models endpoint)
 * - Health check
 * - Stream message completions
 */
export class AnthropicAdapter implements IProvider {
  private http: IPlatformHTTP;
  private apiKey: string;
  private baseUrl: string;
  private customHeaders: Record<string, string>;
  private defaultMaxTokens: number;

  constructor(
    http: IPlatformHTTP,
    apiKey: string,
    options: {
      baseUrl?: string;
      customHeaders?: Record<string, string>;
      defaultMaxTokens?: number;
    } = {}
  ) {
    this.http = http;
    this.apiKey = apiKey;
    this.baseUrl = options.baseUrl?.endsWith("/")
      ? options.baseUrl.slice(0, -1)
      : (options.baseUrl || "https://api.anthropic.com/v1");
    this.customHeaders = options.customHeaders || {};
    this.defaultMaxTokens = options.defaultMaxTokens || 4096;
  }

  /**
   * Get common headers for all requests
   */
  private getHeaders(): Record<string, string> {
    return {
      "x-api-key": this.apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
      ...this.customHeaders,
    };
  }

  /**
   * List available models
   *
   * Note: Anthropic doesn't have a models API endpoint, so we return a static list
   */
  async listModels(): Promise<ModelInfo[]> {
    // Static list of Claude models
    const models: ModelInfo[] = [
      {
        id: "claude-3-opus-20240229",
        object: "model",
        created: 1709251200,
        owned_by: "anthropic",
      },
      {
        id: "claude-3-sonnet-20240229",
        object: "model",
        created: 1709251200,
        owned_by: "anthropic",
      },
      {
        id: "claude-3-haiku-20240307",
        object: "model",
        created: 1709769600,
        owned_by: "anthropic",
      },
      {
        id: "claude-3-5-sonnet-20241022",
        object: "model",
        created: 1729555200,
        owned_by: "anthropic",
      },
      {
        id: "claude-3-5-haiku-20241022",
        object: "model",
        created: 1729555200,
        owned_by: "anthropic",
      },
    ];

    return models;
  }

  /**
   * Health check - verifies API key and connection
   *
   * @returns true if connection is healthy
   * @throws ProviderError if connection fails
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Make a minimal request to verify the API key
      // We'll use a very low max_tokens to minimize cost
      const response = await this.http.request(`${this.baseUrl}/messages`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({
          model: "claude-3-haiku-20240307", // Cheapest model
          max_tokens: 1,
          messages: [{ role: "user", content: "Hi" }],
        }),
      });

      if (!response.ok) {
        throw createProviderErrorFromResponse(
          response.status,
          response.body,
          response.headers
        );
      }

      return true;
    } catch (error) {
      if (error instanceof Error && error.name === "ProviderError") {
        throw error;
      }
      throw createProviderErrorFromNetworkError(error as Error);
    }
  }

  /**
   * Get capabilities for a specific model
   *
   * @param model - Model to check capabilities for
   * @returns Provider capabilities
   */
  getCapabilities(model: string): ProviderCapabilities {
    // Claude 3 models support vision
    const claude3Models = [
      'claude-3-opus',
      'claude-3-sonnet',
      'claude-3-haiku',
      'claude-3-5-sonnet',
      'claude-3-5-haiku',
    ];

    const supportsVision = claude3Models.some(m => model.includes(m));

    return {
      supportsVision,
      supportsStreaming: true,
      requiresMaxTokens: true,
      maxTokensDefault: this.defaultMaxTokens,
      supportedMessageRoles: ['user', 'assistant'], // system is separate
    };
  }

  /**
   * Convert Arc messages to Anthropic format
   *
   * Extracts system message and converts the rest to Anthropic format
   *
   * @returns Object with system message and converted messages
   */
  private convertMessages(
    messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
    attachments?: ImageAttachment[]
  ): { system?: string; messages: AnthropicMessage[] } {
    // Extract system message (if any)
    const systemMessage = messages.find(msg => msg.role === "system");
    const nonSystemMessages = messages.filter(msg => msg.role !== "system");

    // Convert messages to Anthropic format
    const anthropicMessages: AnthropicMessage[] = nonSystemMessages.map((msg, index) => {
      // Add attachments to the last user message
      if (
        msg.role === "user" &&
        index === nonSystemMessages.length - 1 &&
        attachments &&
        attachments.length > 0
      ) {
        const contentBlocks: AnthropicContentBlock[] = [
          { type: "text", text: msg.content },
          ...attachments.map((att): AnthropicContentBlock => {
            // Extract base64 data from data URL if present
            let base64Data = att.data;
            if (base64Data.startsWith("data:")) {
              const commaIndex = base64Data.indexOf(",");
              if (commaIndex !== -1) {
                base64Data = base64Data.slice(commaIndex + 1);
              }
            }

            return {
              type: "image",
              source: {
                type: "base64",
                media_type: att.mimeType,
                data: base64Data,
              },
            };
          }),
        ];

        return { role: msg.role as "user" | "assistant", content: contentBlocks };
      }

      return { role: msg.role as "user" | "assistant", content: msg.content };
    });

    const result: { system?: string; messages: AnthropicMessage[] } = {
      messages: anthropicMessages,
    };

    if (systemMessage) {
      result.system = systemMessage.content;
    }

    return result;
  }

  /**
   * Stream message completion
   *
   * Converts Arc's message format to Anthropic format and streams the response
   *
   * @param messages - Array of messages (user/assistant/system)
   * @param model - Model to use (e.g., "claude-3-opus-20240229")
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
    // Convert messages to Anthropic format
    const { system, messages: anthropicMessages } = this.convertMessages(messages, attachments);

    const request: MessagesRequest = {
      model,
      max_tokens: this.defaultMaxTokens,
      messages: anthropicMessages,
      stream: true,
    };

    if (system) {
      request.system = system;
    }

    try {
      // Build request options
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
        `${this.baseUrl}/messages`,
        requestOptions
      );

      for await (const line of stream) {
        const event = parseStreamEvent(line);

        if (!event) {
          continue; // Skip invalid events
        }

        // Check for errors
        if (isErrorEvent(event)) {
          const errorEvent = event as any;
          throw createProviderErrorFromResponse(
            500, // Anthropic doesn't provide status in error events
            JSON.stringify({ error: errorEvent.error })
          );
        }

        if (isStreamComplete(event)) {
          return; // Stream finished
        }

        const content = extractEventContent(event);
        if (content) {
          yield content;
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        // Check if it's already a ProviderError
        if (error.constructor.name === "ProviderError") {
          throw error;
        }

        // Handle HTTP errors from the stream
        if (error.message.includes("HTTP ")) {
          const match = error.message.match(/HTTP (\d+):/);
          if (match) {
            const status = Number.parseInt(match[1] || "500", 10);
            const body = error.message.split("\n").slice(1).join("\n");
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
