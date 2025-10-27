/**
 * Mock AI Provider for Integration Tests
 *
 * Provides a deterministic mock provider for integration testing.
 * Supports both streaming and non-streaming responses, and error simulation.
 */

import type { Provider, ChatMessage, ChatResult, ChatChunk, ModelInfo } from "@arc/ai/provider.type.js";
import {
  ProviderAuthError,
  ProviderRateLimitError,
  ProviderTimeoutError,
  ProviderServerError,
  ProviderQuotaExceededError,
  ModelNotFoundError,
  ProviderInvalidRequestError,
} from "@arc/ai/errors.js";

export interface MockProviderOptions {
  /** Response to return (default: "Mock response") */
  response?: string;
  /** Whether to simulate an error */
  shouldError?: boolean;
  /** Error to throw */
  error?: Error;
  /** Delay in ms before responding */
  delay?: number;
  /** Stream chunk delay in ms */
  streamDelay?: number;
}

/**
 * Create a deterministic mock AI provider
 */
export function createMockProvider(options: MockProviderOptions = {}): Provider {
  const {
    response = "Mock response",
    shouldError = false,
    error = new Error("Mock provider error"),
    delay = 0,
    streamDelay = 10,
  } = options;

  return {
    async generateChatCompletion(
      _messages: ChatMessage[],
      _model: string,
      _options?: { signal?: AbortSignal }
    ): Promise<ChatResult> {
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      if (shouldError) {
        throw error;
      }

      return {
        content: response,
        metadata: {
          model: _model || "mock-model",
          provider: "mock",
          usage: {
            promptTokens: 10,
            completionTokens: 5,
            totalTokens: 15,
          },
          finishReason: "stop",
        },
      };
    },

    async *streamChatCompletion(
      _messages: ChatMessage[],
      _model: string,
      options?: { signal?: AbortSignal }
    ): AsyncGenerator<ChatChunk> {
      if (shouldError) {
        throw error;
      }

      // Split response into words for streaming
      const words = response.split(" ");

      for (let i = 0; i < words.length; i++) {
        if (streamDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, streamDelay));
        }

        // Check if request was cancelled
        if (options?.signal?.aborted) {
          throw new Error("Request was cancelled");
        }

        const content = i === 0 ? words[i] : ` ${words[i]}`;

        yield { content };
      }

      // Yield final metadata chunk
      yield {
        content: "",
        metadata: {
          model: _model || "mock-model",
          provider: "mock",
          usage: {
            promptTokens: 10,
            completionTokens: words.length,
            totalTokens: 10 + words.length,
          },
          finishReason: "stop",
        },
      };
    },

    async listModels(): Promise<ModelInfo[]> {
      const now = Math.floor(Date.now() / 1000);
      return [
        { id: "mock-model-1", object: "model", created: now, owned_by: "mock" },
        { id: "mock-model-2", object: "model", created: now, owned_by: "mock" },
      ];
    },

    async healthCheck(): Promise<boolean> {
      if (shouldError) {
        throw error;
      }
      return true;
    },

    getCapabilities() {
      return {
        supportsVision: true,
        supportsStreaming: true,
        requiresMaxTokens: false,
        supportedMessageRoles: ["user", "assistant", "system"],
      };
    },
  };
}

/**
 * Create a mock provider that simulates streaming responses
 */
export function createStreamingMockProvider(chunks: string[]): Provider {
  return {
    async generateChatCompletion(
      _messages: ChatMessage[],
      _model: string
    ): Promise<ChatResult> {
      return {
        content: chunks.join(""),
        metadata: {
          model: _model || "mock-streaming",
          provider: "mock",
          usage: {
            promptTokens: 10,
            completionTokens: chunks.length,
            totalTokens: 10 + chunks.length,
          },
          finishReason: "stop",
        },
      };
    },

    async *streamChatCompletion(
      _messages: ChatMessage[],
      _model: string,
      options?: { signal?: AbortSignal }
    ): AsyncGenerator<ChatChunk> {
      for (let i = 0; i < chunks.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 10));

        if (options?.signal?.aborted) {
          throw new Error("Request was cancelled");
        }

        yield {
          content: chunks[i],
        };
      }

      // Yield final metadata chunk
      yield {
        content: "",
        metadata: {
          model: _model || "mock-streaming",
          provider: "mock",
          usage: {
            promptTokens: 10,
            completionTokens: chunks.length,
            totalTokens: 10 + chunks.length,
          },
          finishReason: "stop",
        },
      };
    },

    async listModels() {
      const now = Math.floor(Date.now() / 1000);
      return [{ id: "mock-streaming", object: "model", created: now, owned_by: "mock" }];
    },

    async healthCheck() {
      return true;
    },

    getCapabilities() {
      return {
        supportsVision: false,
        supportsStreaming: true,
        requiresMaxTokens: false,
        supportedMessageRoles: ["user", "assistant", "system"],
      };
    },
  };
}

/**
 * Helper functions to create providers that throw specific error types
 */

export function createAuthErrorProvider(): Provider {
  return createMockProvider({
    shouldError: true,
    error: new ProviderAuthError("Invalid API key", { statusCode: 401 }),
  });
}

export function createRateLimitErrorProvider(retryAfter = 60): Provider {
  return createMockProvider({
    shouldError: true,
    error: new ProviderRateLimitError("Rate limit exceeded", {
      statusCode: 429,
      retryAfter,
    }),
  });
}

export function createTimeoutErrorProvider(): Provider {
  return createMockProvider({
    shouldError: true,
    error: new ProviderTimeoutError("Request timed out", { statusCode: 504 }),
  });
}

export function createServerErrorProvider(): Provider {
  return createMockProvider({
    shouldError: true,
    error: new ProviderServerError("Internal server error", {
      statusCode: 500,
    }),
  });
}

export function createQuotaExceededErrorProvider(): Provider {
  return createMockProvider({
    shouldError: true,
    error: new ProviderQuotaExceededError("Quota exceeded", {
      statusCode: 429,
    }),
  });
}

export function createModelNotFoundErrorProvider(): Provider {
  return createMockProvider({
    shouldError: true,
    error: new ModelNotFoundError("Model not found", { statusCode: 404 }),
  });
}

export function createInvalidRequestErrorProvider(): Provider {
  return createMockProvider({
    shouldError: true,
    error: new ProviderInvalidRequestError("Invalid request parameters", {
      statusCode: 400,
    }),
  });
}
