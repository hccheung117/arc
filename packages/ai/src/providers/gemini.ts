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
 * Gemini API Types (minimal subset for chat)
 */
interface GeminiTextPart {
  text: string;
}

interface GeminiInlineDataPart {
  inlineData: {
    mimeType: string;
    data: string;
  };
}

type GeminiPart = GeminiTextPart | GeminiInlineDataPart;

interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

interface GenerateContentRequest {
  contents: GeminiContent[];
  systemInstruction?: {
    role: "user";
    parts: GeminiTextPart[];
  };
}

interface GenerateContentResponse {
  candidates: Array<{
    content: GeminiContent;
    finishReason?: "STOP" | "MAX_TOKENS" | "SAFETY" | "RECITATION" | "OTHER";
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

interface GenerateContentStreamChunk {
  candidates?: Array<{
    content: GeminiContent;
    finishReason?: "STOP" | "MAX_TOKENS" | "SAFETY" | "RECITATION" | "OTHER";
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

interface ListModelsResponse {
  models: Array<{
    name: string;
    version: string;
    displayName: string;
  }>;
}

interface GeminiErrorResponse {
  error: {
    code: number;
    message: string;
    status: string;
  };
}

/**
 * Gemini Provider Implementation
 *
 * Provides chat completion capabilities using Google's Gemini API.
 * Supports streaming, vision models, and comprehensive error handling.
 */
export class GeminiProvider implements Provider {
  private http: PlatformHTTP;
  private apiKey: string;
  private baseUrl: string;
  private customHeaders: Record<string, string>;

  constructor(http: PlatformHTTP, config: AIConfig) {
    this.http = http;
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl?.endsWith("/")
      ? config.baseUrl.slice(0, -1)
      : (config.baseUrl || "https://generativelanguage.googleapis.com/v1beta");
    this.customHeaders = config.customHeaders || {};
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
   * Map HTTP status code to appropriate error class
   */
  private createErrorFromResponse(
    status: number,
    body: string,
    headers: Record<string, string> = {}
  ): AIError {
    // Parse error message
    let message = "Unknown error";
    let code: number | undefined;

    try {
      const errorResponse = JSON.parse(body) as GeminiErrorResponse;
      message = errorResponse.error.message;
      code = errorResponse.error.code;
    } catch {
      message = body || "Unknown error";
    }

    const errorMessage = `Gemini API error (${status})${code ? ` [${code}]` : ""}: ${message}`;

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
   * Convert our chat messages to Gemini format
   * Note: Gemini uses "model" instead of "assistant"
   */
  private convertMessages(
    messages: ChatMessage[]
  ): { systemInstruction?: { role: "user"; parts: GeminiTextPart[] }; contents: GeminiContent[] } {
    // Extract system message (if any)
    const systemMessage = messages.find((msg) => msg.role === "system");
    const nonSystemMessages = messages.filter((msg) => msg.role !== "system");

    // Convert messages to Gemini format
    const geminiContents: GeminiContent[] = nonSystemMessages.map((msg) => {
      // Map roles: assistant -> model
      const role: "user" | "model" = msg.role === "assistant" ? "model" : "user";

      // Handle images for user messages
      if (msg.role === "user" && msg.images && msg.images.length > 0) {
        const parts: GeminiPart[] = [
          { text: msg.content },
          ...msg.images.map((img): GeminiPart => {
            // Extract base64 data from data URL if present
            let base64Data = img.data;
            if (base64Data.startsWith("data:")) {
              const commaIndex = base64Data.indexOf(",");
              if (commaIndex !== -1) {
                base64Data = base64Data.slice(commaIndex + 1);
              }
            }

            return {
              inlineData: {
                mimeType: img.mimeType,
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
   * Parse streaming chunk from Gemini SSE format
   */
  private parseStreamChunk(line: string): GenerateContentStreamChunk | null {
    try {
      return JSON.parse(line) as GenerateContentStreamChunk;
    } catch {
      return null;
    }
  }

  /**
   * Extract text from Gemini content parts
   */
  private extractText(parts: GeminiPart[]): string {
    return parts
      .filter((part): part is GeminiTextPart => "text" in part)
      .map((part) => part.text)
      .join("");
  }

  // ==================== Provider Interface Methods ====================

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
        throw this.createErrorFromResponse(response.status, response.body, response.headers);
      }

      const data = JSON.parse(response.body) as ListModelsResponse;

      // Convert Gemini model format to ModelInfo
      return data.models.map((model) => ({
        id: model.name,
        object: "model",
        created: 0, // Gemini doesn't provide creation timestamp
        owned_by: "google",
      }));
    } catch (error) {
      if (error instanceof AIError) {
        throw error;
      }
      throw this.createErrorFromNetworkError(error as Error);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // List models is a lightweight endpoint to test connectivity
      await this.listModels();
      return true;
    } catch (error) {
      // Re-throw for caller to handle
      throw error;
    }
  }

  getCapabilities(model: string): ProviderCapabilities {
    // All Gemini models support multimodal inputs
    return {
      supportsVision: true,
      supportsStreaming: true,
      requiresMaxTokens: false,
      supportedMessageRoles: ['user', 'model'], // Note: different from OpenAI/Anthropic
    };
  }

  async *streamChatCompletion(
    messages: ChatMessage[],
    model: string,
    options?: { signal?: AbortSignal }
  ): AsyncGenerator<ChatChunk, void, undefined> {
    const { systemInstruction, contents } = this.convertMessages(messages);

    const request: GenerateContentRequest = {
      contents,
    };

    if (systemInstruction) {
      request.systemInstruction = systemInstruction;
    }

    try {
      // Ensure model has the correct format
      const modelName = model.startsWith("models/") ? model : `models/${model}`;

      const stream = this.http.stream(
        `${this.baseUrl}/${modelName}:streamGenerateContent?key=${this.apiKey}&alt=sse`,
        {
          method: "POST",
          headers: this.getHeaders(),
          body: JSON.stringify(request),
          signal: options?.signal,
        }
      );

      let promptTokens = 0;
      let completionTokens = 0;
      let finishReason: "stop" | "length" | "content_filter" | "function_call" | undefined;

      for await (const line of stream) {
        const chunk = this.parseStreamChunk(line);

        if (!chunk || !chunk.candidates || chunk.candidates.length === 0) {
          continue;
        }

        const candidate = chunk.candidates[0];
        if (!candidate || !candidate.content || !candidate.content.parts) {
          continue;
        }

        // Extract token usage
        if (chunk.usageMetadata) {
          promptTokens = chunk.usageMetadata.promptTokenCount;
          completionTokens = chunk.usageMetadata.candidatesTokenCount;
        }

        // Extract finish reason
        if (candidate.finishReason) {
          finishReason = candidate.finishReason === "STOP"
            ? "stop"
            : candidate.finishReason === "MAX_TOKENS"
            ? "length"
            : undefined;
        }

        // Extract and yield content
        const content = this.extractText(candidate.content.parts);
        if (content) {
          yield {
            content,
            metadata: undefined,
          };
        }
      }

      // Yield final chunk with complete metadata
      yield {
        content: "",
        metadata: {
          model,
          provider: "gemini",
          usage: promptTokens > 0 || completionTokens > 0
            ? {
                promptTokens,
                completionTokens,
                totalTokens: promptTokens + completionTokens,
              }
            : undefined,
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
    const { systemInstruction, contents } = this.convertMessages(messages);

    const request: GenerateContentRequest = {
      contents,
    };

    if (systemInstruction) {
      request.systemInstruction = systemInstruction;
    }

    try {
      // Ensure model has the correct format
      const modelName = model.startsWith("models/") ? model : `models/${model}`;

      const response = await this.http.request(
        `${this.baseUrl}/${modelName}:generateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: this.getHeaders(),
          body: JSON.stringify(request),
          signal: options?.signal,
        }
      );

      if (!response.ok) {
        throw this.createErrorFromResponse(response.status, response.body, response.headers);
      }

      const data = JSON.parse(response.body) as GenerateContentResponse;

      const candidate = data.candidates[0];
      if (!candidate || !candidate.content) {
        throw new AIError("No completion candidate returned from API");
      }

      const content = this.extractText(candidate.content.parts);

      return {
        content,
        metadata: {
          model,
          provider: "gemini",
          usage: data.usageMetadata
            ? {
                promptTokens: data.usageMetadata.promptTokenCount,
                completionTokens: data.usageMetadata.candidatesTokenCount,
                totalTokens: data.usageMetadata.totalTokenCount,
              }
            : undefined,
          finishReason: candidate.finishReason === "STOP"
            ? "stop"
            : candidate.finishReason === "MAX_TOKENS"
            ? "length"
            : undefined,
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
