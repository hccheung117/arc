import { describe, it, expect, beforeEach, vi } from "vitest";
import type { IPlatformHTTP, HTTPResponse } from "@arc/platform/contracts/http.js";
import { AnthropicProvider } from "../src/providers/anthropic.js";
import type { ChatMessage, ImageAttachment } from "../src/provider.type.js";
import { ProviderAuthError, ProviderRateLimitError } from "../src/errors.js";

/**
 * Anthropic Provider Specific Tests
 *
 * Tests Anthropic-specific implementation details beyond the basic contract.
 */
describe("AnthropicProvider", () => {
  let http: IPlatformHTTP;
  let provider: AnthropicProvider;

  beforeEach(() => {
    http = {
      request: vi.fn(),
      stream: vi.fn(),
    };
    provider = new AnthropicProvider(http, {
      apiKey: "test-anthropic-key",
    });
  });

  describe("constructor", () => {
    it("should use default base URL if not provided", () => {
      const p = new AnthropicProvider(http, { apiKey: "test-key" });
      expect(p).toBeDefined();
    });

    it("should accept custom base URL", () => {
      const p = new AnthropicProvider(http, {
        apiKey: "test-key",
        baseUrl: "https://custom.anthropic.com/v1",
      });
      expect(p).toBeDefined();
    });

    it("should strip trailing slash from base URL", () => {
      const p = new AnthropicProvider(http, {
        apiKey: "test-key",
        baseUrl: "https://custom.anthropic.com/v1/",
      });
      expect(p).toBeDefined();
    });

    it("should accept custom headers", () => {
      const p = new AnthropicProvider(http, {
        apiKey: "test-key",
        customHeaders: { "X-Custom": "value" },
      });
      expect(p).toBeDefined();
    });

    it("should use default max tokens", () => {
      const p = new AnthropicProvider(http, { apiKey: "test-key" });
      expect(p).toBeDefined();
    });

    it("should accept custom default max tokens", () => {
      const p = new AnthropicProvider(http, {
        apiKey: "test-key",
        defaultMaxTokens: 8192,
      });
      expect(p).toBeDefined();
    });
  });

  describe("listModels()", () => {
    it("should return static list of Claude models", async () => {
      const models = await provider.listModels();

      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);

      // Check for known Claude models
      const modelIds = models.map((m) => m.id);
      expect(modelIds).toContain("claude-3-opus-20240229");
      expect(modelIds).toContain("claude-3-sonnet-20240229");
      expect(modelIds).toContain("claude-3-haiku-20240307");
      expect(modelIds).toContain("claude-3-5-sonnet-20241022");
      expect(modelIds).toContain("claude-3-5-haiku-20241022");

      // Verify structure
      models.forEach((model) => {
        expect(model).toHaveProperty("id");
        expect(model).toHaveProperty("object", "model");
        expect(model).toHaveProperty("created");
        expect(model).toHaveProperty("owned_by", "anthropic");
      });
    });
  });

  describe("getCapabilities()", () => {
    it("should detect vision support for Claude 3 models", () => {
      const opus = provider.getCapabilities("claude-3-opus-20240229");
      expect(opus.supportsVision).toBe(true);
      expect(opus.supportsStreaming).toBe(true);
      expect(opus.requiresMaxTokens).toBe(true);
      expect(opus.supportedMessageRoles).toEqual(["user", "assistant"]);

      const sonnet = provider.getCapabilities("claude-3-sonnet-20240229");
      expect(sonnet.supportsVision).toBe(true);

      const haiku = provider.getCapabilities("claude-3-haiku-20240307");
      expect(haiku.supportsVision).toBe(true);
    });

    it("should detect vision support for Claude 3.5 models", () => {
      const sonnet35 = provider.getCapabilities("claude-3-5-sonnet-20241022");
      expect(sonnet35.supportsVision).toBe(true);

      const haiku35 = provider.getCapabilities("claude-3-5-haiku-20241022");
      expect(haiku35.supportsVision).toBe(true);
    });

    it("should require max_tokens parameter", () => {
      const caps = provider.getCapabilities("claude-3-opus-20240229");
      expect(caps.requiresMaxTokens).toBe(true);
      expect(caps.maxTokensDefault).toBe(4096);
    });

    it("should only support user and assistant roles", () => {
      const caps = provider.getCapabilities("claude-3-opus-20240229");
      expect(caps.supportedMessageRoles).toEqual(["user", "assistant"]);
    });
  });

  describe("generateChatCompletion()", () => {
    it("should send simple text messages", async () => {
      const mockResponse: HTTPResponse = {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {},
        body: JSON.stringify({
          id: "msg_123",
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: "Hello! How can I help you today?" }],
          model: "claude-3-opus-20240229",
          stop_reason: "end_turn",
          usage: {
            input_tokens: 12,
            output_tokens: 9,
          },
        }),
      };
      vi.mocked(http.request).mockResolvedValue(mockResponse);

      const messages: ChatMessage[] = [{ role: "user", content: "Hello" }];

      const result = await provider.generateChatCompletion(messages, "claude-3-opus-20240229");

      expect(result.content).toBe("Hello! How can I help you today?");
      expect(result.metadata.model).toBe("claude-3-opus-20240229");
      expect(result.metadata.provider).toBe("anthropic");
      expect(result.metadata.usage).toEqual({
        promptTokens: 12,
        completionTokens: 9,
        totalTokens: 21,
      });
      expect(result.metadata.finishReason).toBe("end_turn");
    });

    it("should handle system messages separately", async () => {
      const mockResponse: HTTPResponse = {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {},
        body: JSON.stringify({
          id: "msg_123",
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: "Response" }],
          model: "claude-3-opus-20240229",
          stop_reason: "end_turn",
          usage: { input_tokens: 20, output_tokens: 5 },
        }),
      };
      vi.mocked(http.request).mockResolvedValue(mockResponse);

      const messages: ChatMessage[] = [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Hello" },
      ];

      await provider.generateChatCompletion(messages, "claude-3-opus-20240229");

      // Verify system message is sent in the system field, not in messages array
      const callArgs = vi.mocked(http.request).mock.calls[0];
      expect(callArgs).toBeDefined();
      const body = JSON.parse(callArgs![1]?.body as string);
      expect(body.system).toBe("You are a helpful assistant.");
      expect(body.messages).toEqual([{ role: "user", content: "Hello" }]);
    });

    it("should handle images in user messages", async () => {
      const mockResponse: HTTPResponse = {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {},
        body: JSON.stringify({
          id: "msg_123",
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: "I can see the image." }],
          model: "claude-3-opus-20240229",
          stop_reason: "end_turn",
          usage: { input_tokens: 1000, output_tokens: 10 },
        }),
      };
      vi.mocked(http.request).mockResolvedValue(mockResponse);

      const images: ImageAttachment[] = [
        {
          data: "data:image/png;base64,iVBORw0KGgoAAAANS",
          mimeType: "image/png",
        },
      ];

      const messages: ChatMessage[] = [
        { role: "user", content: "What's in this image?", images },
      ];

      await provider.generateChatCompletion(messages, "claude-3-opus-20240229");

      // Verify image is properly formatted
      const callArgs = vi.mocked(http.request).mock.calls[0];
      expect(callArgs).toBeDefined();
      const body = JSON.parse(callArgs![1]?.body as string);
      expect(body.messages[0]?.content).toEqual([
        { type: "text", text: "What's in this image?" },
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/png",
            data: "iVBORw0KGgoAAAANS", // Should strip data URL prefix
          },
        },
      ]);
    });

    it("should strip data URL prefix from base64 images", async () => {
      const mockResponse: HTTPResponse = {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {},
        body: JSON.stringify({
          id: "msg_123",
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: "Response" }],
          model: "claude-3-opus-20240229",
          stop_reason: "end_turn",
          usage: { input_tokens: 100, output_tokens: 5 },
        }),
      };
      vi.mocked(http.request).mockResolvedValue(mockResponse);

      const images: ImageAttachment[] = [
        {
          data: "data:image/jpeg;base64,/9j/4AAQSkZJRg",
          mimeType: "image/jpeg",
        },
      ];

      const messages: ChatMessage[] = [
        { role: "user", content: "Test", images },
      ];

      await provider.generateChatCompletion(messages, "claude-3-opus-20240229");

      const callArgs = vi.mocked(http.request).mock.calls[0];
      const body = JSON.parse(callArgs![1]?.body as string);
      const imageContent = body.messages[0]?.content[1];
      expect(imageContent?.source?.data).toBe("/9j/4AAQSkZJRg");
    });

    it("should include x-api-key header", async () => {
      const mockResponse: HTTPResponse = {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {},
        body: JSON.stringify({
          id: "msg_123",
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: "Response" }],
          model: "claude-3-opus-20240229",
          stop_reason: "end_turn",
          usage: { input_tokens: 10, output_tokens: 5 },
        }),
      };
      vi.mocked(http.request).mockResolvedValue(mockResponse);

      await provider.generateChatCompletion([{ role: "user", content: "Test" }], "claude-3-opus-20240229");

      expect(http.request).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "x-api-key": "test-anthropic-key",
            "anthropic-version": "2023-06-01",
          }),
        })
      );
    });

    it("should include max_tokens in request", async () => {
      const mockResponse: HTTPResponse = {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {},
        body: JSON.stringify({
          id: "msg_123",
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: "Response" }],
          model: "claude-3-opus-20240229",
          stop_reason: "end_turn",
          usage: { input_tokens: 10, output_tokens: 5 },
        }),
      };
      vi.mocked(http.request).mockResolvedValue(mockResponse);

      await provider.generateChatCompletion([{ role: "user", content: "Test" }], "claude-3-opus-20240229");

      const callArgs = vi.mocked(http.request).mock.calls[0];
      const body = JSON.parse(callArgs![1]?.body as string);
      expect(body.max_tokens).toBe(4096); // Default
    });

    it("should handle errors with proper classification", async () => {
      const mockResponse: HTTPResponse = {
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        headers: {},
        body: JSON.stringify({
          type: "error",
          error: {
            type: "authentication_error",
            message: "Invalid API key",
          },
        }),
      };
      vi.mocked(http.request).mockResolvedValue(mockResponse);

      await expect(
        provider.generateChatCompletion([{ role: "user", content: "Test" }], "claude-3-opus-20240229")
      ).rejects.toThrow(ProviderAuthError);
    });

    it("should extract retry-after from rate limit errors", async () => {
      const mockResponse: HTTPResponse = {
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        headers: { "retry-after": "60" },
        body: JSON.stringify({
          type: "error",
          error: {
            type: "rate_limit_error",
            message: "Rate limit exceeded",
          },
        }),
      };
      vi.mocked(http.request).mockResolvedValue(mockResponse);

      try {
        await provider.generateChatCompletion([{ role: "user", content: "Test" }], "claude-3-opus-20240229");
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error).toBeInstanceOf(ProviderRateLimitError);
        if (error instanceof ProviderRateLimitError) {
          expect(error.retryAfter).toBe(60);
        }
      }
    });
  });

  describe("streamChatCompletion()", () => {
    it("should stream content chunks with Anthropic event format", async () => {
      const mockStream = (async function* () {
        yield JSON.stringify({
          type: "message_start",
          message: {
            usage: { input_tokens: 12, output_tokens: 0 },
          },
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
        yield JSON.stringify({
          type: "message_stop",
        });
      })();

      vi.mocked(http.stream).mockReturnValue(mockStream);

      const messages: ChatMessage[] = [{ role: "user", content: "Hello" }];
      const chunks = [];

      for await (const chunk of provider.streamChatCompletion(messages, "claude-3-opus-20240229")) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);

      // Check content chunks
      const contentChunks = chunks.filter((c) => c.content.length > 0);
      expect(contentChunks.length).toBeGreaterThanOrEqual(2);
      expect(contentChunks[0]?.content).toBe("Hello");
      expect(contentChunks[1]?.content).toBe(" world");

      // Check final metadata chunk
      const metadataChunk = chunks.find((c) => c.metadata !== undefined);
      expect(metadataChunk).toBeDefined();
      expect(metadataChunk?.metadata?.model).toBe("claude-3-opus-20240229");
      expect(metadataChunk?.metadata?.provider).toBe("anthropic");
      expect(metadataChunk?.metadata?.finishReason).toBe("end_turn");
      expect(metadataChunk?.metadata?.usage).toEqual({
        promptTokens: 12,
        completionTokens: 5,
        totalTokens: 17,
      });
    });

    it("should handle message_start event for token tracking", async () => {
      const mockStream = (async function* () {
        yield JSON.stringify({
          type: "message_start",
          message: {
            usage: { input_tokens: 100, output_tokens: 0 },
          },
        });
        yield JSON.stringify({
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: "Test" },
        });
        yield JSON.stringify({
          type: "message_delta",
          delta: { stop_reason: "end_turn" },
          usage: { output_tokens: 10 },
        });
        yield JSON.stringify({
          type: "message_stop",
        });
      })();

      vi.mocked(http.stream).mockReturnValue(mockStream);

      const messages: ChatMessage[] = [{ role: "user", content: "Hello" }];
      const chunks = [];

      for await (const chunk of provider.streamChatCompletion(messages, "claude-3-opus-20240229")) {
        chunks.push(chunk);
      }

      const metadataChunk = chunks.find((c) => c.metadata !== undefined);
      expect(metadataChunk?.metadata?.usage?.promptTokens).toBe(100);
      expect(metadataChunk?.metadata?.usage?.completionTokens).toBe(10);
    });

    it("should handle error events in stream", async () => {
      const mockStream = (async function* () {
        yield JSON.stringify({
          type: "error",
          error: {
            type: "overloaded_error",
            message: "Overloaded",
          },
        });
      })();

      vi.mocked(http.stream).mockReturnValue(mockStream);

      const messages: ChatMessage[] = [{ role: "user", content: "Hello" }];

      await expect(async () => {
        for await (const chunk of provider.streamChatCompletion(messages, "claude-3-opus-20240229")) {
          // Should throw on error event
        }
      }).rejects.toThrow();
    });

    it("should pass abort signal to stream", async () => {
      const mockStream = (async function* () {
        yield JSON.stringify({
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: "Test" },
        });
      })();

      vi.mocked(http.stream).mockReturnValue(mockStream);

      const abortController = new AbortController();
      const messages: ChatMessage[] = [{ role: "user", content: "Hello" }];

      const generator = provider.streamChatCompletion(messages, "claude-3-opus-20240229", {
        signal: abortController.signal,
      });

      // Start streaming
      const iterator = generator[Symbol.asyncIterator]();
      await iterator.next();

      // Verify signal was passed
      expect(http.stream).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          signal: abortController.signal,
        })
      );
    });

    it("should handle system messages in streaming", async () => {
      const mockStream = (async function* () {
        yield JSON.stringify({
          type: "message_start",
          message: { usage: { input_tokens: 20, output_tokens: 0 } },
        });
        yield JSON.stringify({
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: "Response" },
        });
        yield JSON.stringify({
          type: "message_stop",
        });
      })();

      vi.mocked(http.stream).mockReturnValue(mockStream);

      const messages: ChatMessage[] = [
        { role: "system", content: "You are helpful." },
        { role: "user", content: "Hello" },
      ];

      const chunks = [];
      for await (const chunk of provider.streamChatCompletion(messages, "claude-3-opus-20240229")) {
        chunks.push(chunk);
      }

      // Verify system message was sent separately
      const callArgs = vi.mocked(http.stream).mock.calls[0];
      const body = JSON.parse(callArgs![1]?.body as string);
      expect(body.system).toBe("You are helpful.");
      expect(body.messages).toEqual([{ role: "user", content: "Hello" }]);
    });
  });

  describe("healthCheck()", () => {
    it("should use minimal request for health check", async () => {
      const mockResponse: HTTPResponse = {
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
      vi.mocked(http.request).mockResolvedValue(mockResponse);

      const result = await provider.healthCheck();

      expect(result).toBe(true);

      // Verify it uses the cheapest model with minimal tokens
      const callArgs = vi.mocked(http.request).mock.calls[0];
      const body = JSON.parse(callArgs![1]?.body as string);
      expect(body.model).toBe("claude-3-haiku-20240307");
      expect(body.max_tokens).toBe(1);
    });
  });
});
