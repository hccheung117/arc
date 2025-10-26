import { describe, it, expect, beforeEach, vi } from "vitest";
import type { IPlatformHTTP, HTTPResponse } from "@arc/platform/contracts/http.js";
import { OpenAIProvider } from "../src/providers/openai.js";
import type { ChatMessage, ImageAttachment } from "../src/provider.type.js";
import { ProviderAuthError, ProviderRateLimitError } from "../src/errors.js";

/**
 * OpenAI Provider Specific Tests
 *
 * Tests OpenAI-specific implementation details beyond the basic contract.
 */
describe("OpenAIProvider", () => {
  let http: IPlatformHTTP;
  let provider: OpenAIProvider;

  beforeEach(() => {
    http = {
      request: vi.fn(),
      stream: vi.fn(),
    };
    provider = new OpenAIProvider(http, {
      apiKey: "test-openai-key",
    });
  });

  describe("constructor", () => {
    it("should use default base URL if not provided", () => {
      const p = new OpenAIProvider(http, { apiKey: "test-key" });
      expect(p).toBeDefined();
    });

    it("should accept custom base URL", () => {
      const p = new OpenAIProvider(http, {
        apiKey: "test-key",
        baseUrl: "https://custom.openai.com/v1",
      });
      expect(p).toBeDefined();
    });

    it("should strip trailing slash from base URL", () => {
      const p = new OpenAIProvider(http, {
        apiKey: "test-key",
        baseUrl: "https://custom.openai.com/v1/",
      });
      expect(p).toBeDefined();
    });

    it("should accept custom headers", () => {
      const p = new OpenAIProvider(http, {
        apiKey: "test-key",
        customHeaders: { "X-Custom": "value" },
      });
      expect(p).toBeDefined();
    });
  });

  describe("listModels()", () => {
    it("should call /models endpoint", async () => {
      const mockResponse: HTTPResponse = {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {},
        body: JSON.stringify({
          object: "list",
          data: [
            { id: "gpt-4", object: "model", created: 1687882410, owned_by: "openai" },
            { id: "gpt-3.5-turbo", object: "model", created: 1677610602, owned_by: "openai" },
          ],
        }),
      };
      vi.mocked(http.request).mockResolvedValue(mockResponse);

      const models = await provider.listModels();

      expect(http.request).toHaveBeenCalledWith(
        expect.stringContaining("/models"),
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Authorization: "Bearer test-openai-key",
          }),
        })
      );
      expect(models).toHaveLength(2);
      expect(models[0]?.id).toBe("gpt-4");
      expect(models[1]?.id).toBe("gpt-3.5-turbo");
    });

    it("should include Authorization header", async () => {
      const mockResponse: HTTPResponse = {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {},
        body: JSON.stringify({ object: "list", data: [] }),
      };
      vi.mocked(http.request).mockResolvedValue(mockResponse);

      await provider.listModels();

      expect(http.request).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-openai-key",
          }),
        })
      );
    });
  });

  describe("getCapabilities()", () => {
    it("should detect vision support for gpt-4-vision models", () => {
      const caps = provider.getCapabilities("gpt-4-vision-preview");
      expect(caps.supportsVision).toBe(true);
      expect(caps.supportsStreaming).toBe(true);
      expect(caps.requiresMaxTokens).toBe(false);
      expect(caps.supportedMessageRoles).toEqual(["user", "assistant", "system"]);
    });

    it("should detect vision support for gpt-4-turbo models", () => {
      const caps = provider.getCapabilities("gpt-4-turbo-2024-04-09");
      expect(caps.supportsVision).toBe(true);
    });

    it("should detect vision support for gpt-4o models", () => {
      const caps = provider.getCapabilities("gpt-4o");
      expect(caps.supportsVision).toBe(true);
    });

    it("should not detect vision support for gpt-3.5 models", () => {
      const caps = provider.getCapabilities("gpt-3.5-turbo");
      expect(caps.supportsVision).toBe(false);
    });

    it("should not require max_tokens parameter", () => {
      const caps = provider.getCapabilities("gpt-4");
      expect(caps.requiresMaxTokens).toBe(false);
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
          id: "chatcmpl-123",
          object: "chat.completion",
          created: 1677652288,
          model: "gpt-4",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: "Hello! How can I help you?" },
              finish_reason: "stop",
            },
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 8,
            total_tokens: 18,
          },
        }),
      };
      vi.mocked(http.request).mockResolvedValue(mockResponse);

      const messages: ChatMessage[] = [
        { role: "user", content: "Hello" },
      ];

      const result = await provider.generateChatCompletion(messages, "gpt-4");

      expect(result.content).toBe("Hello! How can I help you?");
      expect(result.metadata.model).toBe("gpt-4");
      expect(result.metadata.provider).toBe("openai");
      expect(result.metadata.usage).toEqual({
        promptTokens: 10,
        completionTokens: 8,
        totalTokens: 18,
      });
      expect(result.metadata.finishReason).toBe("stop");
    });

    it("should send system messages", async () => {
      const mockResponse: HTTPResponse = {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {},
        body: JSON.stringify({
          id: "chatcmpl-123",
          model: "gpt-4",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: "Response" },
              finish_reason: "stop",
            },
          ],
        }),
      };
      vi.mocked(http.request).mockResolvedValue(mockResponse);

      const messages: ChatMessage[] = [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Hello" },
      ];

      await provider.generateChatCompletion(messages, "gpt-4");

      // Verify system message is included in request
      const callArgs = vi.mocked(http.request).mock.calls[0];
      expect(callArgs).toBeDefined();
      const body = JSON.parse(callArgs![1]?.body as string);
      expect(body.messages).toEqual([
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Hello" },
      ]);
    });

    it("should handle images in user messages", async () => {
      const mockResponse: HTTPResponse = {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {},
        body: JSON.stringify({
          id: "chatcmpl-123",
          model: "gpt-4-vision-preview",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: "I see an image." },
              finish_reason: "stop",
            },
          ],
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

      await provider.generateChatCompletion(messages, "gpt-4-vision-preview");

      // Verify image is properly formatted
      const callArgs = vi.mocked(http.request).mock.calls[0];
      expect(callArgs).toBeDefined();
      const body = JSON.parse(callArgs![1]?.body as string);
      expect(body.messages[0]?.content).toEqual([
        { type: "text", text: "What's in this image?" },
        {
          type: "image_url",
          image_url: {
            url: "data:image/png;base64,iVBORw0KGgoAAAANS",
            detail: "auto",
          },
        },
      ]);
    });

    it("should include custom headers", async () => {
      const customProvider = new OpenAIProvider(http, {
        apiKey: "test-key",
        customHeaders: { "X-Custom-Header": "custom-value" },
      });

      const mockResponse: HTTPResponse = {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {},
        body: JSON.stringify({
          id: "chatcmpl-123",
          model: "gpt-4",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: "Response" },
              finish_reason: "stop",
            },
          ],
        }),
      };
      vi.mocked(http.request).mockResolvedValue(mockResponse);

      await customProvider.generateChatCompletion([{ role: "user", content: "Test" }], "gpt-4");

      expect(http.request).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-Custom-Header": "custom-value",
          }),
        })
      );
    });

    it("should handle errors with proper classification", async () => {
      const mockResponse: HTTPResponse = {
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        headers: {},
        body: JSON.stringify({
          error: {
            message: "Invalid API key",
            type: "invalid_request_error",
            code: "invalid_api_key",
          },
        }),
      };
      vi.mocked(http.request).mockResolvedValue(mockResponse);

      await expect(
        provider.generateChatCompletion([{ role: "user", content: "Test" }], "gpt-4")
      ).rejects.toThrow(ProviderAuthError);
    });

    it("should extract retry-after from rate limit errors", async () => {
      const mockResponse: HTTPResponse = {
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        headers: { "retry-after": "120" },
        body: JSON.stringify({
          error: {
            message: "Rate limit exceeded",
            type: "rate_limit_error",
          },
        }),
      };
      vi.mocked(http.request).mockResolvedValue(mockResponse);

      try {
        await provider.generateChatCompletion([{ role: "user", content: "Test" }], "gpt-4");
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error).toBeInstanceOf(ProviderRateLimitError);
        if (error instanceof ProviderRateLimitError) {
          expect(error.retryAfter).toBe(120);
        }
      }
    });
  });

  describe("streamChatCompletion()", () => {
    it("should stream content chunks", async () => {
      const mockStream = (async function* () {
        yield JSON.stringify({
          id: "chatcmpl-123",
          object: "chat.completion.chunk",
          created: 1677652288,
          model: "gpt-4",
          choices: [{ index: 0, delta: { content: "Hello" }, finish_reason: null }],
        });
        yield JSON.stringify({
          id: "chatcmpl-123",
          object: "chat.completion.chunk",
          created: 1677652288,
          model: "gpt-4",
          choices: [{ index: 0, delta: { content: " world" }, finish_reason: null }],
        });
        yield JSON.stringify({
          id: "chatcmpl-123",
          object: "chat.completion.chunk",
          created: 1677652288,
          model: "gpt-4",
          choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
        });
      })();

      vi.mocked(http.stream).mockReturnValue(mockStream);

      const messages: ChatMessage[] = [{ role: "user", content: "Hello" }];
      const chunks = [];

      for await (const chunk of provider.streamChatCompletion(messages, "gpt-4")) {
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
      expect(metadataChunk?.metadata?.model).toBe("gpt-4");
      expect(metadataChunk?.metadata?.provider).toBe("openai");
      expect(metadataChunk?.metadata?.finishReason).toBe("stop");
    });

    it("should handle empty deltas", async () => {
      const mockStream = (async function* () {
        yield JSON.stringify({
          id: "chatcmpl-123",
          model: "gpt-4",
          choices: [{ index: 0, delta: {}, finish_reason: null }],
        });
        yield JSON.stringify({
          id: "chatcmpl-123",
          model: "gpt-4",
          choices: [{ index: 0, delta: { content: "Test" }, finish_reason: null }],
        });
      })();

      vi.mocked(http.stream).mockReturnValue(mockStream);

      const messages: ChatMessage[] = [{ role: "user", content: "Hello" }];
      const chunks = [];

      for await (const chunk of provider.streamChatCompletion(messages, "gpt-4")) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
    });

    it("should pass abort signal to stream", async () => {
      const mockStream = (async function* () {
        yield JSON.stringify({
          id: "chatcmpl-123",
          model: "gpt-4",
          choices: [{ index: 0, delta: { content: "Test" }, finish_reason: null }],
        });
      })();

      vi.mocked(http.stream).mockReturnValue(mockStream);

      const abortController = new AbortController();
      const messages: ChatMessage[] = [{ role: "user", content: "Hello" }];

      const generator = provider.streamChatCompletion(messages, "gpt-4", {
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

    it("should handle streaming errors", async () => {
      const mockStream = (async function* () {
        throw new Error("HTTP 500: Internal Server Error\n{\"error\":{\"message\":\"Server error\"}}");
      })();

      vi.mocked(http.stream).mockReturnValue(mockStream);

      const messages: ChatMessage[] = [{ role: "user", content: "Hello" }];

      await expect(async () => {
        for await (const chunk of provider.streamChatCompletion(messages, "gpt-4")) {
          // Should throw before yielding any chunks
        }
      }).rejects.toThrow();
    });
  });

  describe("healthCheck()", () => {
    it("should use listModels for health check", async () => {
      const mockResponse: HTTPResponse = {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {},
        body: JSON.stringify({ object: "list", data: [] }),
      };
      vi.mocked(http.request).mockResolvedValue(mockResponse);

      const result = await provider.healthCheck();

      expect(result).toBe(true);
      expect(http.request).toHaveBeenCalledWith(
        expect.stringContaining("/models"),
        expect.any(Object)
      );
    });
  });
});
