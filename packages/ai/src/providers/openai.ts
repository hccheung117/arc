import type { IPlatformHTTP } from "@arc/platform/contracts/http.js";
import type {
  Provider,
  ChatMessage,
  ChatChunk,
  ChatResult,
  ModelInfo,
  ProviderCapabilities,
  ImageAttachment,
  AIConfig,
} from "../provider.js";
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
 * OpenAI API Types (minimal subset for chat)
 */
interface OpenAIMessageContent {
  type: "text" | "image_url";
  text?: string;
  image_url?: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
}

interface OpenAIMessage {
  role: "user" | "assistant" | "system";
  content: string | OpenAIMessageContent[];
}

interface ChatCompletionRequest {
  model: string;
  messages: OpenAIMessage[];
  stream: boolean;
  temperature?: number;
}

interface ChatCompletionChunk {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason: "stop" | "length" | "content_filter" | null;
  }>;
}

interface ChatCompletionResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: "stop" | "length" | "content_filter" | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface ListModelsResponse {
  object: "list";
  data: Array<{
    id: string;
    object: "model";
    created: number;
    owned_by: string;
  }>;
}

interface OpenAIErrorResponse {
  error: {
    message: string;
    type: string;
    code?: string;
  };
}

/**
 * OpenAI Provider Implementation
 *
 * Provides chat completion capabilities using OpenAI's API.
 * Supports streaming, vision models, and comprehensive error handling.
 */
export class OpenAIProvider implements Provider {
  private http: IPlatformHTTP;
  private apiKey: string;
  private baseUrl: string;
  private customHeaders: Record<string, string>;

  constructor(http: IPlatformHTTP, config: AIConfig) {
    this.http = http;
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl?.endsWith("/")
      ? config.baseUrl.slice(0, -1)
      : (config.baseUrl || "https://api.openai.com/v1");
    this.customHeaders = config.customHeaders || {};
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
   * Map HTTP status code to appropriate error class
   */
  private createErrorFromResponse(
    status: number,
    body: string,
    headers: Record<string, string> = {}
  ): AIError {
    // Parse error message
    let message = "Unknown error";
    let code: string | undefined;

    try {
      const errorResponse = JSON.parse(body) as OpenAIErrorResponse;
      message = errorResponse.error.message;
      code = errorResponse.error.code;
    } catch {
      message = body || "Unknown error";
    }

    const errorMessage = `OpenAI API error (${status})${code ? ` [${code}]` : ""}: ${message}`;

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
   * Convert our chat messages to OpenAI format
   */
  private convertMessages(messages: ChatMessage[]): OpenAIMessage[] {
    return messages.map((msg) => {
      // Handle images for user messages
      if (msg.role === "user" && msg.images && msg.images.length > 0) {
        const content: OpenAIMessageContent[] = [
          { type: "text", text: msg.content },
          ...msg.images.map((img) => ({
            type: "image_url" as const,
            image_url: {
              url: img.data,
              detail: "auto" as const,
            },
          })),
        ];
        return { role: msg.role, content };
      }

      return { role: msg.role, content: msg.content };
    });
  }

  /**
   * Parse streaming chunk from OpenAI SSE format
   */
  private parseStreamChunk(line: string): ChatCompletionChunk | null {
    try {
      return JSON.parse(line) as ChatCompletionChunk;
    } catch {
      return null;
    }
  }

  // ==================== Provider Interface Methods ====================

  async listModels(): Promise<ModelInfo[]> {
    try {
      const response = await this.http.request(`${this.baseUrl}/models`, {
        method: "GET",
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw this.createErrorFromResponse(response.status, response.body, response.headers);
      }

      const data = JSON.parse(response.body) as ListModelsResponse;
      return data.data;
    } catch (error) {
      if (error instanceof AIError) {
        throw error;
      }
      throw this.createErrorFromNetworkError(error as Error);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.listModels();
      return true;
    } catch (error) {
      // Re-throw for caller to handle
      throw error;
    }
  }

  getCapabilities(model: string): ProviderCapabilities {
    // Vision-capable models
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
      requiresMaxTokens: false,
      supportedMessageRoles: ['user', 'assistant', 'system'],
    };
  }

  async *streamChatCompletion(
    messages: ChatMessage[],
    model: string,
    options?: { signal?: AbortSignal }
  ): AsyncGenerator<ChatChunk, void, undefined> {
    const openAIMessages = this.convertMessages(messages);

    const request: ChatCompletionRequest = {
      model,
      messages: openAIMessages,
      stream: true,
      temperature: 0.7,
    };

    try {
      const stream = this.http.stream(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(request),
        signal: options?.signal,
      });

      let totalContent = "";
      let finishReason: "stop" | "length" | "content_filter" | "function_call" | undefined;

      for await (const line of stream) {
        const chunk = this.parseStreamChunk(line);

        if (!chunk || !chunk.choices || chunk.choices.length === 0) {
          continue;
        }

        const choice = chunk.choices[0];
        if (!choice) {
          continue;
        }

        const content = choice.delta.content || "";
        totalContent += content;

        // Check for finish
        if (choice.finish_reason) {
          finishReason = choice.finish_reason;
        }

        // Yield content chunk
        yield {
          content,
          metadata: undefined,
        };
      }

      // Yield final chunk with complete metadata
      yield {
        content: "",
        metadata: {
          model,
          provider: "openai",
          usage: undefined, // OpenAI doesn't provide token counts in streaming
          finishReason,
        },
      };
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
    const openAIMessages = this.convertMessages(messages);

    const request: ChatCompletionRequest = {
      model,
      messages: openAIMessages,
      stream: false,
      temperature: 0.7,
    };

    try {
      const response = await this.http.request(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(request),
        signal: options?.signal,
      });

      if (!response.ok) {
        throw this.createErrorFromResponse(response.status, response.body, response.headers);
      }

      const data = JSON.parse(response.body) as ChatCompletionResponse;

      const choice = data.choices[0];
      if (!choice) {
        throw new AIError("No completion choice returned from API");
      }

      return {
        content: choice.message.content,
        metadata: {
          model: data.model,
          provider: "openai",
          usage: data.usage
            ? {
                promptTokens: data.usage.prompt_tokens,
                completionTokens: data.usage.completion_tokens,
                totalTokens: data.usage.total_tokens,
              }
            : undefined,
          finishReason: choice.finish_reason || undefined,
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
