import type { PlatformHTTP } from "@arc/platform/contracts/http.js";
import type {
  Provider,
  ChatMessage,
  ChatChunk,
  ChatResult,
  ModelInfo,
  ProviderCapabilities,
  ImageAttachment,
  AIConfig,
} from "../provider.type.js";
import {
  AIError,
  ProviderAuthError,
  ProviderRateLimitError,
  ProviderTimeoutError,
  ProviderQuotaExceededError,
  ModelNotFoundError,
  ProviderServerError,
  ProviderInvalidRequestError,
  RequestCancelledError,
} from "../errors.js";

/**
 * Anthropic API Types (minimal subset for chat)
 */
interface AnthropicTextContent {
  type: "text";
  text: string;
}

interface AnthropicImageContent {
  type: "image";
  source: {
    type: "base64";
    media_type: string;
    data: string;
  };
}

type AnthropicContentBlock = AnthropicTextContent | AnthropicImageContent;

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
}

interface MessagesRequest {
  model: string;
  messages: AnthropicMessage[];
  max_tokens: number;
  system?: string;
  stream: boolean;
  temperature?: number;
}

interface MessagesResponse {
  id: string;
  type: "message";
  role: "assistant";
  content: Array<{
    type: "text";
    text: string;
  }>;
  model: string;
  stop_reason: "end_turn" | "max_tokens" | "stop_sequence" | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

interface AnthropicStreamEvent {
  type: string;
}

interface ContentBlockDeltaEvent extends AnthropicStreamEvent {
  type: "content_block_delta";
  index: number;
  delta: {
    type: "text_delta";
    text: string;
  };
}

interface MessageDeltaEvent extends AnthropicStreamEvent {
  type: "message_delta";
  delta: {
    stop_reason: "end_turn" | "max_tokens" | "stop_sequence" | null;
  };
  usage: {
    output_tokens: number;
  };
}

interface MessageStartEvent extends AnthropicStreamEvent {
  type: "message_start";
  message: {
    usage: {
      input_tokens: number;
      output_tokens: number;
    };
  };
}

interface ErrorEvent extends AnthropicStreamEvent {
  type: "error";
  error: {
    type: string;
    message: string;
  };
}

interface AnthropicErrorResponse {
  type: "error";
  error: {
    type: string;
    message: string;
  };
}

/**
 * Anthropic Provider Implementation
 *
 * Provides chat completion capabilities using Anthropic's Messages API.
 * Supports streaming, vision models (Claude 3), and comprehensive error handling.
 */
export class AnthropicProvider implements Provider {
  private http: PlatformHTTP;
  private apiKey: string;
  private baseUrl: string;
  private customHeaders: Record<string, string>;
  private defaultMaxTokens: number;

  constructor(http: PlatformHTTP, config: AIConfig) {
    this.http = http;
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl?.endsWith("/")
      ? config.baseUrl.slice(0, -1)
      : (config.baseUrl || "https://api.anthropic.com/v1");
    this.customHeaders = config.customHeaders || {};
    this.defaultMaxTokens = config.defaultMaxTokens || 4096;
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
   * Map HTTP status code to appropriate error class
   */
  private createErrorFromResponse(
    status: number,
    body: string,
    headers: Record<string, string> = {}
  ): AIError {
    // Parse error message
    let message = "Unknown error";
    let type: string | undefined;

    try {
      const errorResponse = JSON.parse(body) as AnthropicErrorResponse;
      message = errorResponse.error.message;
      type = errorResponse.error.type;
    } catch {
      message = body || "Unknown error";
    }

    const errorMessage = `Anthropic API error (${status})${type ? ` [${type}]` : ""}: ${message}`;

    // Map status codes to error types
    switch (status) {
      case 401:
        return new ProviderAuthError(errorMessage, { statusCode: status });

      case 403:
        return new ProviderQuotaExceededError(errorMessage, { statusCode: status });

      case 429: {
        const retryAfter = this.extractRetryAfter(headers);
        return new ProviderRateLimitError(errorMessage, {
          statusCode: status,
          retryAfter,
        });
      }

      case 404:
        return new ModelNotFoundError(errorMessage, { statusCode: status });

      case 400:
      case 413:
        return new ProviderInvalidRequestError(errorMessage, { statusCode: status });

      case 500:
      case 502:
      case 503:
        return new ProviderServerError(errorMessage, { statusCode: status });

      case 504:
        return new ProviderTimeoutError(errorMessage, { statusCode: status });

      default:
        return new AIError(errorMessage, {
          statusCode: status,
          isRetryable: status >= 500,
        });
    }
  }

  /**
   * Extract retry-after header value (in seconds)
   */
  private extractRetryAfter(headers: Record<string, string>): number | undefined {
    const retryAfter = headers["retry-after"] || headers["Retry-After"];
    if (retryAfter) {
      const seconds = Number.parseInt(retryAfter, 10);
      if (!Number.isNaN(seconds)) {
        return seconds;
      }
    }
    return undefined;
  }

  /**
   * Handle network errors (not HTTP errors)
   */
  private createErrorFromNetworkError(error: Error): AIError {
    if (error.message.includes("cancelled") || error.message.includes("abort")) {
      return new RequestCancelledError("Request was cancelled", { cause: error });
    }

    if (error.message.includes("timeout")) {
      return new ProviderTimeoutError("Request timed out. Please try again.", {
        cause: error,
      });
    }

    return new AIError(`Network error: ${error.message}`, {
      isRetryable: true,
      cause: error,
    });
  }

  /**
   * Convert our chat messages to Anthropic format
   * Anthropic separates system messages from the messages array
   */
  private convertMessages(
    messages: ChatMessage[]
  ): { system?: string; messages: AnthropicMessage[] } {
    // Extract system message (if any)
    const systemMessage = messages.find((msg) => msg.role === "system");
    const nonSystemMessages = messages.filter((msg) => msg.role !== "system");

    // Convert messages to Anthropic format
    const anthropicMessages: AnthropicMessage[] = nonSystemMessages.map((msg) => {
      // Handle images for user messages
      if (msg.role === "user" && msg.images && msg.images.length > 0) {
        const contentBlocks: AnthropicContentBlock[] = [
          { type: "text", text: msg.content },
          ...msg.images.map((img): AnthropicContentBlock => {
            // Extract base64 data from data URL if present
            let base64Data = img.data;
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
                media_type: img.mimeType,
                data: base64Data,
              },
            };
          }),
        ];

        return { role: "user", content: contentBlocks };
      }

      // Note: Anthropic doesn't support system in message array
      return {
        role: msg.role as "user" | "assistant",
        content: msg.content,
      };
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
   * Parse streaming event from Anthropic SSE format
   */
  private parseStreamEvent(line: string): AnthropicStreamEvent | null {
    try {
      return JSON.parse(line) as AnthropicStreamEvent;
    } catch {
      return null;
    }
  }

  // ==================== Provider Interface Methods ====================

  async listModels(): Promise<ModelInfo[]> {
    // Anthropic doesn't have a models API endpoint, return static list
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

  async healthCheck(): Promise<boolean> {
    try {
      // Make a minimal request to verify the API key
      // Use the cheapest model with minimal tokens to minimize cost
      const response = await this.http.request(`${this.baseUrl}/messages`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({
          model: "claude-3-haiku-20240307",
          max_tokens: 1,
          messages: [{ role: "user", content: "Hi" }],
        }),
      });

      if (!response.ok) {
        throw this.createErrorFromResponse(response.status, response.body, response.headers);
      }

      return true;
    } catch (error) {
      if (error instanceof AIError) {
        throw error;
      }
      throw this.createErrorFromNetworkError(error as Error);
    }
  }

  getCapabilities(model: string): ProviderCapabilities {
    // Claude 3+ models support vision
    const claude3Models = [
      'claude-3-opus',
      'claude-3-sonnet',
      'claude-3-haiku',
      'claude-3-5-sonnet',
      'claude-3-5-haiku',
    ];

    const supportsVision = claude3Models.some((m) => model.includes(m));

    return {
      supportsVision,
      supportsStreaming: true,
      requiresMaxTokens: true,
      maxTokensDefault: this.defaultMaxTokens,
      supportedMessageRoles: ['user', 'assistant'], // system is separate
    };
  }

  async *streamChatCompletion(
    messages: ChatMessage[],
    model: string,
    options?: { signal?: AbortSignal }
  ): AsyncGenerator<ChatChunk, void, undefined> {
    const { system, messages: anthropicMessages } = this.convertMessages(messages);

    const request: MessagesRequest = {
      model,
      max_tokens: this.defaultMaxTokens,
      messages: anthropicMessages,
      stream: true,
      temperature: 0.7,
    };

    if (system) {
      request.system = system;
    }

    try {
      const stream = this.http.stream(`${this.baseUrl}/messages`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(request),
        signal: options?.signal,
      });

      let inputTokens = 0;
      let outputTokens = 0;
      let stopReason: "stop" | "length" | "content_filter" | "function_call" | undefined;

      for await (const line of stream) {
        const event = this.parseStreamEvent(line);

        if (!event) {
          continue;
        }

        // Check for errors
        if (event.type === "error") {
          const errorEvent = event as ErrorEvent;
          throw this.createErrorFromResponse(
            500,
            JSON.stringify({ error: errorEvent.error })
          );
        }

        // Extract token usage from message_start
        if (event.type === "message_start") {
          const startEvent = event as MessageStartEvent;
          inputTokens = startEvent.message.usage.input_tokens;
          outputTokens = startEvent.message.usage.output_tokens;
        }

        // Extract content from content_block_delta
        if (event.type === "content_block_delta") {
          const deltaEvent = event as ContentBlockDeltaEvent;
          if (deltaEvent.delta.type === "text_delta") {
            yield {
              content: deltaEvent.delta.text,
              metadata: undefined,
            };
          }
        }

        // Extract final usage from message_delta
        if (event.type === "message_delta") {
          const deltaEvent = event as MessageDeltaEvent;
          outputTokens = deltaEvent.usage.output_tokens;
          stopReason = deltaEvent.delta.stop_reason as typeof stopReason;
        }

        // Stream complete
        if (event.type === "message_stop") {
          // Yield final chunk with complete metadata
          yield {
            content: "",
            metadata: {
              model,
              provider: "anthropic",
              usage: {
                promptTokens: inputTokens,
                completionTokens: outputTokens,
                totalTokens: inputTokens + outputTokens,
              },
              finishReason: stopReason,
            },
          };
          return;
        }
      }
    } catch (error) {
      if (error instanceof AIError) {
        throw error;
      }

      // Handle HTTP errors from the stream
      if (error instanceof Error && error.message.includes("HTTP ")) {
        const match = error.message.match(/HTTP (\d+):/);
        if (match) {
          const status = Number.parseInt(match[1] || "500", 10);
          const body = error.message.split("\n").slice(1).join("\n");
          throw this.createErrorFromResponse(status, body);
        }
      }

      throw this.createErrorFromNetworkError(error as Error);
    }
  }

  async generateChatCompletion(
    messages: ChatMessage[],
    model: string,
    options?: { signal?: AbortSignal }
  ): Promise<ChatResult> {
    const { system, messages: anthropicMessages } = this.convertMessages(messages);

    const request: MessagesRequest = {
      model,
      max_tokens: this.defaultMaxTokens,
      messages: anthropicMessages,
      stream: false,
      temperature: 0.7,
    };

    if (system) {
      request.system = system;
    }

    try {
      const response = await this.http.request(`${this.baseUrl}/messages`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(request),
        signal: options?.signal,
      });

      if (!response.ok) {
        throw this.createErrorFromResponse(response.status, response.body, response.headers);
      }

      const data = JSON.parse(response.body) as MessagesResponse;

      // Extract text content from content blocks
      const textContent = data.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("");

      return {
        content: textContent,
        metadata: {
          model: data.model,
          provider: "anthropic",
          usage: {
            promptTokens: data.usage.input_tokens,
            completionTokens: data.usage.output_tokens,
            totalTokens: data.usage.input_tokens + data.usage.output_tokens,
          },
          finishReason: data.stop_reason as ChatResult["metadata"]["finishReason"],
        },
      };
    } catch (error) {
      if (error instanceof AIError) {
        throw error;
      }
      throw this.createErrorFromNetworkError(error as Error);
    }
  }
}
