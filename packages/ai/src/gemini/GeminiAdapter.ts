import type { IPlatformHTTP } from "@arc/core/platform/IPlatformHTTP.js";
import type { ImageAttachment } from "@arc/contracts/ImageAttachment.js";
import type { IProvider, ModelInfo, ProviderCapabilities } from "@arc/contracts/IProvider.js";
import type {
  GeminiContent,
  GeminiPart,
  GeminiTextPart,
  GenerateContentRequest,
  ListModelsResponse,
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

/**
 * Gemini API adapter
 *
 * Provides methods for interacting with Google's Gemini API:
 * - List available models
 * - Health check
 * - Stream content generation
 */
export class GeminiAdapter implements IProvider {
  private http: IPlatformHTTP;
  private apiKey: string;
  private baseUrl: string;
  private customHeaders: Record<string, string>;

  constructor(
    http: IPlatformHTTP,
    apiKey: string,
    options: {
      baseUrl?: string;
      customHeaders?: Record<string, string>;
    } = {}
  ) {
    this.http = http;
    this.apiKey = apiKey;
    this.baseUrl = options.baseUrl?.endsWith("/")
      ? options.baseUrl.slice(0, -1)
      : (options.baseUrl || "https://generativelanguage.googleapis.com/v1beta");
    this.customHeaders = options.customHeaders || {};
  }

  /**
   * Get common headers for all requests
   */
  private getHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      ...this.customHeaders,
    };
  }

  /**
   * List available models
   */
  async listModels(): Promise<ModelInfo[]> {
    try {
      const response = await this.http.request(
        `${this.baseUrl}/models?key=${this.apiKey}`,
        {
          method: "GET",
          headers: this.getHeaders(),
        }
      );

      if (!response.ok) {
        throw createProviderErrorFromResponse(
          response.status,
          response.body,
          response.headers
        );
      }

      const data = JSON.parse(response.body) as ListModelsResponse;

      // Convert Gemini model format to ModelInfo
      return data.models.map(model => ({
        id: model.name,
        object: "model",
        created: 0, // Gemini doesn't provide creation timestamp
        owned_by: "google",
      }));
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
    // All Gemini models support multimodal inputs
    return {
      supportsVision: true,
      supportsStreaming: true,
      requiresMaxTokens: false, // Gemini has defaults
      supportedMessageRoles: ['user', 'model'], // Note: different from OpenAI/Anthropic
    };
  }

  /**
   * Convert Arc messages to Gemini format
   *
   * Maps role names and wraps content in parts
   *
   * @returns Object with system instruction and converted contents
   */
  private convertMessages(
    messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
    attachments?: ImageAttachment[]
  ): { systemInstruction?: { role: "user"; parts: GeminiTextPart[] }; contents: GeminiContent[] } {
    // Extract system message (if any)
    const systemMessage = messages.find(msg => msg.role === "system");
    const nonSystemMessages = messages.filter(msg => msg.role !== "system");

    // Convert messages to Gemini format
    const geminiContents: GeminiContent[] = nonSystemMessages.map((msg, index) => {
      // Map roles: assistant -> model
      const role: "user" | "model" = msg.role === "assistant" ? "model" : "user";

      // Add attachments to the last user message
      if (
        msg.role === "user" &&
        index === nonSystemMessages.length - 1 &&
        attachments &&
        attachments.length > 0
      ) {
        const parts: GeminiPart[] = [
          { text: msg.content },
          ...attachments.map((att): GeminiPart => {
            // Extract base64 data from data URL if present
            let base64Data = att.data;
            if (base64Data.startsWith("data:")) {
              const commaIndex = base64Data.indexOf(",");
              if (commaIndex !== -1) {
                base64Data = base64Data.slice(commaIndex + 1);
              }
            }

            return {
              inlineData: {
                mimeType: att.mimeType,
                data: base64Data,
              },
            };
          }),
        ];

        return { role, parts };
      }

      // Regular text message
      return {
        role,
        parts: [{ text: msg.content }],
      };
    });

    const result: {
      systemInstruction?: { role: "user"; parts: GeminiTextPart[] };
      contents: GeminiContent[];
    } = {
      contents: geminiContents,
    };

    if (systemMessage) {
      result.systemInstruction = {
        role: "user",
        parts: [{ text: systemMessage.content }],
      };
    }

    return result;
  }

  /**
   * Stream chat completion
   *
   * Converts Arc's message format to Gemini format and streams the response
   *
   * @param messages - Array of messages (user/assistant/system)
   * @param model - Model to use (e.g., "gemini-2.0-flash-exp")
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
    // Convert messages to Gemini format
    const { systemInstruction, contents } = this.convertMessages(messages, attachments);

    const request: GenerateContentRequest = {
      contents,
    };

    if (systemInstruction) {
      request.systemInstruction = systemInstruction;
    }

    try {
      // Extract model name if it's a full resource path
      const modelName = model.startsWith("models/") ? model : `models/${model}`;

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
        `${this.baseUrl}/${modelName}:streamGenerateContent?key=${this.apiKey}&alt=sse`,
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
