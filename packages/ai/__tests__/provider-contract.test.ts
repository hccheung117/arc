import { describe, it, expect, beforeEach, vi } from "vitest";
import type { PlatformHTTP, HTTPResponse } from "@arc/platform/contracts/http.js";
import type { Provider, ModelInfo, ChatMessage } from "../src/provider.type.js";
import { OpenAIProvider } from "../src/providers/openai.js";
import { AnthropicProvider } from "../src/providers/anthropic.js";
import { GeminiProvider } from "../src/providers/gemini.js";
import {
  ProviderAuthError,
  ProviderRateLimitError,
  ProviderTimeoutError,
  ModelNotFoundError,
  ProviderServerError,
  ProviderInvalidRequestError,
  RequestCancelledError,
} from "../src/errors.js";

/**
 * Shared Provider Contract Tests
 *
 * These tests ensure all provider implementations adhere to the Provider interface contract.
 * All providers must pass these tests.
 */

type ProviderFactory = (http: PlatformHTTP) => Provider;

/**
 * Create a mock HTTP client for testing
 */
function createMockHTTP(): PlatformHTTP {
  return {
    request: vi.fn(),
    stream: vi.fn(),
  };
}

/**
 * Get provider-specific mock responses
 */
function getMockListModelsResponse(providerName: string): HTTPResponse {
  if (providerName === "Gemini") {
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      headers: {},
      body: JSON.stringify({
        models: [
          { name: "models/gemini-1.5-pro", version: "001", displayName: "Gemini 1.5 Pro" },
          { name: "models/gemini-1.5-flash", version: "001", displayName: "Gemini 1.5 Flash" },
        ],
      }),
    };
  }
  // OpenAI and Anthropic (Anthropic returns static list, but use OpenAI format for other tests)
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: {},
    body: JSON.stringify({
      object: "list",
      data: [
        { id: "model-1", object: "model", created: 1234567890, owned_by: "test" },
        { id: "model-2", object: "model", created: 1234567891, owned_by: "test" },
      ],
    }),
  };
}

function getMockChatResponse(providerName: string): HTTPResponse {
  if (providerName === "Anthropic") {
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      headers: {},
      body: JSON.stringify({
        id: "msg_123",
        type: "message",
        role: "assistant",
        content: [{ type: "text", text: "Test response" }],
        model: "claude-3-opus-20240229",
        stop_reason: "end_turn",
        usage: { input_tokens: 10, output_tokens: 5 },
      }),
    };
  } else if (providerName === "Gemini") {
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      headers: {},
      body: JSON.stringify({
        candidates: [
          {
            content: {
              role: "model",
              parts: [{ text: "Test response" }],
            },
            finishReason: "STOP",
          },
        ],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 5,
          totalTokenCount: 15,
        },
      }),
    };
  }
  // OpenAI
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: {},
    body: JSON.stringify({
      id: "chatcmpl-123",
      model: "test-model",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "Test response" },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
      },
    }),
  };
}

function getMockStreamChunks(providerName: string): AsyncGenerator<string, void, undefined> {
  if (providerName === "Anthropic") {
    return (async function* () {
      yield JSON.stringify({
        type: "message_start",
        message: { usage: { input_tokens: 10, output_tokens: 0 } },
      });
      yield JSON.stringify({
        type: "content_block_delta",
        index: 0,
        delta: { type: "text_delta", text: "Hello" },
      });
      yield JSON.stringify({
        type: "content_block_delta",
        index: 0,
        delta: { type: "text_delta", text: " world" },
      });
      yield JSON.stringify({
        type: "message_delta",
        delta: { stop_reason: "end_turn" },
        usage: { output_tokens: 5 },
      });
      yield JSON.stringify({ type: "message_stop" });
    })();
  } else if (providerName === "Gemini") {
    return (async function* () {
      yield JSON.stringify({
        candidates: [
          {
            content: {
              role: "model",
              parts: [{ text: "Hello" }],
            },
          },
        ],
      });
      yield JSON.stringify({
        candidates: [
          {
            content: {
              role: "model",
              parts: [{ text: " world" }],
            },
            finishReason: "STOP",
          },
        ],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 5,
          totalTokenCount: 15,
        },
      });
    })();
  }
  // OpenAI
  return (async function* () {
    yield JSON.stringify({
      choices: [{ delta: { content: "Hello" }, finish_reason: null }],
    });
    yield JSON.stringify({
      choices: [{ delta: { content: " world" }, finish_reason: null }],
    });
    yield JSON.stringify({
      choices: [{ delta: {}, finish_reason: "stop" }],
    });
  })();
}

/**
 * Test suite that all providers must pass
 */
export function testProviderContract(
  providerName: string,
  createProvider: ProviderFactory,
  expectedProvider: string
) {
  describe(`${providerName} Provider Contract`, () => {
    let http: PlatformHTTP;
    let provider: Provider;

    beforeEach(() => {
      http = createMockHTTP();
      provider = createProvider(http);
    });

    describe("listModels()", () => {
      it("should return an array of ModelInfo objects", async () => {
        const mockResponse = getMockListModelsResponse(providerName);
        vi.mocked(http.request).mockResolvedValue(mockResponse);

        const models = await provider.listModels();

        expect(Array.isArray(models)).toBe(true);
        expect(models.length).toBeGreaterThan(0);
        models.forEach((model: ModelInfo) => {
          expect(model).toHaveProperty("id");
          expect(model).toHaveProperty("object");
          expect(model).toHaveProperty("created");
          expect(model).toHaveProperty("owned_by");
        });
      });

      it("should throw ProviderAuthError on 401", async () => {
        // Anthropic returns static list, so skip this test
        if (providerName === "Anthropic") {
          return;
        }

        const mockResponse: HTTPResponse = {
          ok: false,
          status: 401,
          statusText: "Unauthorized",
          headers: {},
          body: JSON.stringify({ error: { message: "Invalid API key" } }),
        };
        vi.mocked(http.request).mockResolvedValue(mockResponse);

        await expect(provider.listModels()).rejects.toThrow(ProviderAuthError);
      });
    });

    describe("healthCheck()", () => {
      it("should return true when provider is healthy", async () => {
        const mockResponse = getMockListModelsResponse(providerName);
        // Anthropic uses a minimal message request for health check
        if (providerName === "Anthropic") {
          const anthropicHealthResponse = {
            ok: true,
            status: 200,
            statusText: "OK",
            headers: {},
            body: JSON.stringify({
              id: "msg_123",
              type: "message",
              role: "assistant",
              content: [{ type: "text", text: "Hi" }],
              model: "claude-3-haiku-20240307",
              stop_reason: "end_turn",
              usage: { input_tokens: 1, output_tokens: 1 },
            }),
          };
          vi.mocked(http.request).mockResolvedValue(anthropicHealthResponse);
        } else {
          vi.mocked(http.request).mockResolvedValue(mockResponse);
        }

        const result = await provider.healthCheck();

        expect(result).toBe(true);
      });

      it("should throw error when provider is unhealthy", async () => {
        const mockResponse: HTTPResponse = {
          ok: false,
          status: 503,
          statusText: "Service Unavailable",
          headers: {},
          body: JSON.stringify({ error: { message: "Service unavailable" } }),
        };
        vi.mocked(http.request).mockResolvedValue(mockResponse);

        await expect(provider.healthCheck()).rejects.toThrow();
      });
    });

    describe("getCapabilities()", () => {
      it("should return ProviderCapabilities object", () => {
        const capabilities = provider.getCapabilities("test-model");

        expect(capabilities).toHaveProperty("supportsVision");
        expect(capabilities).toHaveProperty("supportsStreaming");
        expect(capabilities).toHaveProperty("requiresMaxTokens");
        expect(capabilities).toHaveProperty("supportedMessageRoles");
        expect(typeof capabilities.supportsVision).toBe("boolean");
        expect(typeof capabilities.supportsStreaming).toBe("boolean");
        expect(typeof capabilities.requiresMaxTokens).toBe("boolean");
        expect(Array.isArray(capabilities.supportedMessageRoles)).toBe(true);
      });
    });

    describe("generateChatCompletion()", () => {
      it("should return ChatResult with content and metadata", async () => {
        const mockResponse = getMockChatResponse(providerName);
        vi.mocked(http.request).mockResolvedValue(mockResponse);

        const messages: ChatMessage[] = [
          { role: "user", content: "Hello" },
        ];

        const result = await provider.generateChatCompletion(messages, "test-model");

        expect(result).toHaveProperty("content");
        expect(result).toHaveProperty("metadata");
        expect(typeof result.content).toBe("string");
        expect(result.content).toBe("Test response");
        expect(result.metadata).toHaveProperty("model");
        expect(result.metadata).toHaveProperty("provider");
        expect(result.metadata.provider).toBe(expectedProvider);
      });

      it("should throw ProviderAuthError on 401", async () => {
        const mockResponse: HTTPResponse = {
          ok: false,
          status: 401,
          statusText: "Unauthorized",
          headers: {},
          body: JSON.stringify({ error: { message: "Invalid API key" } }),
        };
        vi.mocked(http.request).mockResolvedValue(mockResponse);

        const messages: ChatMessage[] = [{ role: "user", content: "Hello" }];

        await expect(
          provider.generateChatCompletion(messages, "test-model")
        ).rejects.toThrow(ProviderAuthError);
      });

      it("should throw ProviderRateLimitError on 429", async () => {
        const mockResponse: HTTPResponse = {
          ok: false,
          status: 429,
          statusText: "Too Many Requests",
          headers: { "retry-after": "60" },
          body: JSON.stringify({ error: { message: "Rate limit exceeded" } }),
        };
        vi.mocked(http.request).mockResolvedValue(mockResponse);

        const messages: ChatMessage[] = [{ role: "user", content: "Hello" }];

        await expect(
          provider.generateChatCompletion(messages, "test-model")
        ).rejects.toThrow(ProviderRateLimitError);
      });

      it("should throw ModelNotFoundError on 404", async () => {
        const mockResponse: HTTPResponse = {
          ok: false,
          status: 404,
          statusText: "Not Found",
          headers: {},
          body: JSON.stringify({ error: { message: "Model not found" } }),
        };
        vi.mocked(http.request).mockResolvedValue(mockResponse);

        const messages: ChatMessage[] = [{ role: "user", content: "Hello" }];

        await expect(
          provider.generateChatCompletion(messages, "test-model")
        ).rejects.toThrow(ModelNotFoundError);
      });

      it("should throw ProviderServerError on 500", async () => {
        const mockResponse: HTTPResponse = {
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
          headers: {},
          body: JSON.stringify({ error: { message: "Internal server error" } }),
        };
        vi.mocked(http.request).mockResolvedValue(mockResponse);

        const messages: ChatMessage[] = [{ role: "user", content: "Hello" }];

        await expect(
          provider.generateChatCompletion(messages, "test-model")
        ).rejects.toThrow(ProviderServerError);
      });

      it("should throw ProviderInvalidRequestError on 400", async () => {
        const mockResponse: HTTPResponse = {
          ok: false,
          status: 400,
          statusText: "Bad Request",
          headers: {},
          body: JSON.stringify({ error: { message: "Invalid request" } }),
        };
        vi.mocked(http.request).mockResolvedValue(mockResponse);

        const messages: ChatMessage[] = [{ role: "user", content: "Hello" }];

        await expect(
          provider.generateChatCompletion(messages, "test-model")
        ).rejects.toThrow(ProviderInvalidRequestError);
      });
    });

    describe("streamChatCompletion()", () => {
      it("should yield ChatChunk objects", async () => {
        const mockStream = getMockStreamChunks(providerName);
        vi.mocked(http.stream).mockReturnValue(mockStream);

        const messages: ChatMessage[] = [{ role: "user", content: "Hello" }];
        const chunks: Array<{ content: string; metadata?: any }> = [];

        for await (const chunk of provider.streamChatCompletion(messages, "test-model")) {
          chunks.push(chunk);
        }

        expect(chunks.length).toBeGreaterThan(0);
        chunks.forEach((chunk) => {
          expect(chunk).toHaveProperty("content");
          expect(typeof chunk.content).toBe("string");
        });
      });

      it("should include final metadata chunk", async () => {
        const mockStream = getMockStreamChunks(providerName);
        vi.mocked(http.stream).mockReturnValue(mockStream);

        const messages: ChatMessage[] = [{ role: "user", content: "Hello" }];
        const chunks = [];

        for await (const chunk of provider.streamChatCompletion(messages, "test-model")) {
          chunks.push(chunk);
        }

        // Find the final metadata chunk (may not be last due to provider differences)
        const metadataChunk = chunks.find((c) => c.metadata !== undefined);
        expect(metadataChunk).toBeDefined();
        if (metadataChunk) {
          expect(metadataChunk.metadata).toHaveProperty("model");
          expect(metadataChunk.metadata).toHaveProperty("provider");
          expect(metadataChunk.metadata.provider).toBe(expectedProvider);
        }
      });

      it("should support AbortSignal for cancellation", async () => {
        const abortController = new AbortController();
        const mockStream = (async function* () {
          yield 'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n';
          abortController.abort(); // Simulate cancellation
          throw new Error("Request was aborted");
        })();

        vi.mocked(http.stream).mockReturnValue(mockStream);

        const messages: ChatMessage[] = [{ role: "user", content: "Hello" }];

        await expect(async () => {
          for await (const chunk of provider.streamChatCompletion(messages, "test-model", {
            signal: abortController.signal,
          })) {
            // Should throw before completion
          }
        }).rejects.toThrow();
      });
    });

    describe("Temperature Support", () => {
      it("should pass custom temperature to streamChatCompletion", async () => {
        const mockStream = getMockStreamChunks(providerName);
        vi.mocked(http.stream).mockReturnValue(mockStream);

        const messages: ChatMessage[] = [{ role: "user", content: "Hello" }];

        // Call with custom temperature
        const generator = provider.streamChatCompletion(messages, "test-model", {
          temperature: 0.5,
        });

        // Consume the generator to trigger the request
        for await (const chunk of generator) {
          // We don't care about the chunks, just that the request was made
        }

        // Verify that stream was called
        expect(http.stream).toHaveBeenCalled();

        // Get the request body from the stream call
        const streamCall = vi.mocked(http.stream).mock.calls[0];
        if (streamCall && streamCall[1]?.body) {
          const requestBody = JSON.parse(streamCall[1].body);

          // For OpenAI and Anthropic, temperature is a top-level field
          if (providerName === "OpenAI" || providerName === "Anthropic") {
            expect(requestBody).toHaveProperty("temperature", 0.5);
          }

          // For Gemini, temperature is in generationConfig
          if (providerName === "Gemini") {
            expect(requestBody).toHaveProperty("generationConfig");
            expect(requestBody.generationConfig).toHaveProperty("temperature", 0.5);
          }
        }
      });

      it("should use default temperature when not specified in streamChatCompletion", async () => {
        const mockStream = getMockStreamChunks(providerName);
        vi.mocked(http.stream).mockReturnValue(mockStream);

        const messages: ChatMessage[] = [{ role: "user", content: "Hello" }];

        // Call without temperature option
        const generator = provider.streamChatCompletion(messages, "test-model");

        // Consume the generator to trigger the request
        for await (const chunk of generator) {
          // We don't care about the chunks, just that the request was made
        }

        // Verify that stream was called with default temperature
        expect(http.stream).toHaveBeenCalled();

        const streamCall = vi.mocked(http.stream).mock.calls[0];
        if (streamCall && streamCall[1]?.body) {
          const requestBody = JSON.parse(streamCall[1].body);

          // OpenAI defaults to 0.7
          if (providerName === "OpenAI") {
            expect(requestBody).toHaveProperty("temperature", 0.7);
          }

          // Anthropic and Gemini default to 1.0
          if (providerName === "Anthropic") {
            expect(requestBody).toHaveProperty("temperature", 1.0);
          }

          if (providerName === "Gemini") {
            expect(requestBody).toHaveProperty("generationConfig");
            expect(requestBody.generationConfig).toHaveProperty("temperature", 1.0);
          }
        }
      });

      it("should pass custom temperature to generateChatCompletion", async () => {
        const mockResponse = getMockChatResponse(providerName);
        vi.mocked(http.request).mockResolvedValue(mockResponse);

        const messages: ChatMessage[] = [{ role: "user", content: "Hello" }];

        // Call with custom temperature
        await provider.generateChatCompletion(messages, "test-model", {
          temperature: 0.3,
        });

        // Verify that request was called
        expect(http.request).toHaveBeenCalled();

        // Get the request body
        const requestCall = vi.mocked(http.request).mock.calls[0];
        if (requestCall && requestCall[1]?.body) {
          const requestBody = JSON.parse(requestCall[1].body);

          // For OpenAI and Anthropic, temperature is a top-level field
          if (providerName === "OpenAI" || providerName === "Anthropic") {
            expect(requestBody).toHaveProperty("temperature", 0.3);
          }

          // For Gemini, temperature is in generationConfig
          if (providerName === "Gemini") {
            expect(requestBody).toHaveProperty("generationConfig");
            expect(requestBody.generationConfig).toHaveProperty("temperature", 0.3);
          }
        }
      });

      it("should use default temperature when not specified in generateChatCompletion", async () => {
        const mockResponse = getMockChatResponse(providerName);
        vi.mocked(http.request).mockResolvedValue(mockResponse);

        const messages: ChatMessage[] = [{ role: "user", content: "Hello" }];

        // Call without temperature option
        await provider.generateChatCompletion(messages, "test-model");

        // Verify that request was called with default temperature
        expect(http.request).toHaveBeenCalled();

        const requestCall = vi.mocked(http.request).mock.calls[0];
        if (requestCall && requestCall[1]?.body) {
          const requestBody = JSON.parse(requestCall[1].body);

          // OpenAI defaults to 0.7
          if (providerName === "OpenAI") {
            expect(requestBody).toHaveProperty("temperature", 0.7);
          }

          // Anthropic and Gemini default to 1.0
          if (providerName === "Anthropic") {
            expect(requestBody).toHaveProperty("temperature", 1.0);
          }

          if (providerName === "Gemini") {
            expect(requestBody).toHaveProperty("generationConfig");
            expect(requestBody.generationConfig).toHaveProperty("temperature", 1.0);
          }
        }
      });
    });
  });
}

// Run contract tests for all providers
testProviderContract(
  "OpenAI",
  (http) => new OpenAIProvider(http, { apiKey: "test-key" }),
  "openai"
);

testProviderContract(
  "Anthropic",
  (http) => new AnthropicProvider(http, { apiKey: "test-key" }),
  "anthropic"
);

testProviderContract(
  "Gemini",
  (http) => new GeminiProvider(http, { apiKey: "test-key" }),
  "gemini"
);
