import { describe, it, expect, beforeEach, vi } from "vitest";
import type { IPlatformHTTP, HTTPResponse } from "@arc/platform/contracts/http.js";
import { GeminiProvider } from "../src/providers/gemini.js";
import type { ChatMessage, ImageAttachment } from "../src/provider.type.js";
import { ProviderAuthError, ProviderRateLimitError } from "../src/errors.js";

/**
 * Gemini Provider Specific Tests
 *
 * Tests Gemini-specific implementation details beyond the basic contract.
 */
describe("GeminiProvider", () => {
  let http: IPlatformHTTP;
  let provider: GeminiProvider;

  beforeEach(() => {
    http = {
      request: vi.fn(),
      stream: vi.fn(),
    };
    provider = new GeminiProvider(http, {
      apiKey: "test-gemini-key",
    });
  });

  describe("constructor", () => {
    it("should use default base URL if not provided", () => {
      const p = new GeminiProvider(http, { apiKey: "test-key" });
      expect(p).toBeDefined();
    });

    it("should accept custom base URL", () => {
      const p = new GeminiProvider(http, {
        apiKey: "test-key",
        baseUrl: "https://custom.googleapis.com/v1beta",
      });
      expect(p).toBeDefined();
    });

    it("should strip trailing slash from base URL", () => {
      const p = new GeminiProvider(http, {
        apiKey: "test-key",
        baseUrl: "https://custom.googleapis.com/v1beta/",
      });
      expect(p).toBeDefined();
    });

    it("should accept custom headers", () => {
      const p = new GeminiProvider(http, {
        apiKey: "test-key",
        customHeaders: { "X-Custom": "value" },
      });
      expect(p).toBeDefined();
    });
  });

  describe("listModels()", () => {
    it("should call models endpoint with API key in query", async () => {
      const mockResponse: HTTPResponse = {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {},
        body: JSON.stringify({
          models: [
            {
              name: "models/gemini-1.5-pro",
              version: "001",
              displayName: "Gemini 1.5 Pro",
            },
            {
              name: "models/gemini-1.5-flash",
              version: "001",
              displayName: "Gemini 1.5 Flash",
            },
          ],
        }),
      };
      vi.mocked(http.request).mockResolvedValue(mockResponse);

      const models = await provider.listModels();

      expect(http.request).toHaveBeenCalledWith(
        expect.stringContaining("key=test-gemini-key"),
        expect.objectContaining({
          method: "GET",
        })
      );
      expect(models).toHaveLength(2);
      expect(models[0]?.id).toBe("models/gemini-1.5-pro");
      expect(models[1]?.id).toBe("models/gemini-1.5-flash");
    });

    it("should convert Gemini model format to ModelInfo", async () => {
      const mockResponse: HTTPResponse = {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {},
        body: JSON.stringify({
          models: [
            {
              name: "models/gemini-pro",
              version: "001",
              displayName: "Gemini Pro",
            },
          ],
        }),
      };
      vi.mocked(http.request).mockResolvedValue(mockResponse);

      const models = await provider.listModels();

      expect(models[0]).toEqual({
        id: "models/gemini-pro",
        object: "model",
        created: 0,
        owned_by: "google",
      });
    });
  });

  describe("getCapabilities()", () => {
    it("should report vision support for all models", () => {
      const pro = provider.getCapabilities("gemini-1.5-pro");
      expect(pro.supportsVision).toBe(true);
      expect(pro.supportsStreaming).toBe(true);
      expect(pro.requiresMaxTokens).toBe(false);
      expect(pro.supportedMessageRoles).toEqual(["user", "model"]);

      const flash = provider.getCapabilities("gemini-1.5-flash");
      expect(flash.supportsVision).toBe(true);

      const anyModel = provider.getCapabilities("any-model-name");
      expect(anyModel.supportsVision).toBe(true);
    });

    it("should not require max_tokens parameter", () => {
      const caps = provider.getCapabilities("gemini-pro");
      expect(caps.requiresMaxTokens).toBe(false);
    });

    it("should use user and model roles (not assistant)", () => {
      const caps = provider.getCapabilities("gemini-pro");
      expect(caps.supportedMessageRoles).toEqual(["user", "model"]);
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
          candidates: [
            {
              content: {
                role: "model",
                parts: [{ text: "Hello! How can I help you today?" }],
              },
              finishReason: "STOP",
            },
          ],
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 8,
            totalTokenCount: 18,
          },
        }),
      };
      vi.mocked(http.request).mockResolvedValue(mockResponse);

      const messages: ChatMessage[] = [{ role: "user", content: "Hello" }];

      const result = await provider.generateChatCompletion(messages, "gemini-1.5-pro");

      expect(result.content).toBe("Hello! How can I help you today?");
      expect(result.metadata.model).toBe("gemini-1.5-pro");
      expect(result.metadata.provider).toBe("gemini");
      expect(result.metadata.usage).toEqual({
        promptTokens: 10,
        completionTokens: 8,
        totalTokens: 18,
      });
      expect(result.metadata.finishReason).toBe("stop");
    });

    it("should convert assistant role to model role", async () => {
      const mockResponse: HTTPResponse = {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {},
        body: JSON.stringify({
          candidates: [
            {
              content: {
                role: "model",
                parts: [{ text: "Response" }],
              },
              finishReason: "STOP",
            },
          ],
        }),
      };
      vi.mocked(http.request).mockResolvedValue(mockResponse);

      const messages: ChatMessage[] = [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there!" },
        { role: "user", content: "How are you?" },
      ];

      await provider.generateChatCompletion(messages, "gemini-pro");

      const callArgs = vi.mocked(http.request).mock.calls[0];
      expect(callArgs).toBeDefined();
      const body = JSON.parse(callArgs![1]?.body as string);
      expect(body.contents).toEqual([
        { role: "user", parts: [{ text: "Hello" }] },
        { role: "model", parts: [{ text: "Hi there!" }] },
        { role: "user", parts: [{ text: "How are you?" }] },
      ]);
    });

    it("should handle system messages as systemInstruction", async () => {
      const mockResponse: HTTPResponse = {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {},
        body: JSON.stringify({
          candidates: [
            {
              content: {
                role: "model",
                parts: [{ text: "Response" }],
              },
              finishReason: "STOP",
            },
          ],
        }),
      };
      vi.mocked(http.request).mockResolvedValue(mockResponse);

      const messages: ChatMessage[] = [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Hello" },
      ];

      await provider.generateChatCompletion(messages, "gemini-pro");

      const callArgs = vi.mocked(http.request).mock.calls[0];
      const body = JSON.parse(callArgs![1]?.body as string);
      expect(body.systemInstruction).toEqual({
        role: "user",
        parts: [{ text: "You are a helpful assistant." }],
      });
      expect(body.contents).toEqual([{ role: "user", parts: [{ text: "Hello" }] }]);
    });

    it("should handle images in user messages", async () => {
      const mockResponse: HTTPResponse = {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {},
        body: JSON.stringify({
          candidates: [
            {
              content: {
                role: "model",
                parts: [{ text: "I can see the image." }],
              },
              finishReason: "STOP",
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

      await provider.generateChatCompletion(messages, "gemini-1.5-pro");

      const callArgs = vi.mocked(http.request).mock.calls[0];
      const body = JSON.parse(callArgs![1]?.body as string);
      expect(body.contents[0]?.parts).toEqual([
        { text: "What's in this image?" },
        {
          inlineData: {
            mimeType: "image/png",
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
          candidates: [
            {
              content: {
                role: "model",
                parts: [{ text: "Response" }],
              },
              finishReason: "STOP",
            },
          ],
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

      await provider.generateChatCompletion(messages, "gemini-pro");

      const callArgs = vi.mocked(http.request).mock.calls[0];
      const body = JSON.parse(callArgs![1]?.body as string);
      const imageContent = body.contents[0]?.parts[1];
      expect(imageContent?.inlineData?.data).toBe("/9j/4AAQSkZJRg");
    });

    it("should add models/ prefix if not present", async () => {
      const mockResponse: HTTPResponse = {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {},
        body: JSON.stringify({
          candidates: [
            {
              content: {
                role: "model",
                parts: [{ text: "Response" }],
              },
              finishReason: "STOP",
            },
          ],
        }),
      };
      vi.mocked(http.request).mockResolvedValue(mockResponse);

      await provider.generateChatCompletion([{ role: "user", content: "Test" }], "gemini-pro");

      expect(http.request).toHaveBeenCalledWith(
        expect.stringContaining("/models/gemini-pro:generateContent"),
        expect.any(Object)
      );
    });

    it("should not add models/ prefix if already present", async () => {
      const mockResponse: HTTPResponse = {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {},
        body: JSON.stringify({
          candidates: [
            {
              content: {
                role: "model",
                parts: [{ text: "Response" }],
              },
              finishReason: "STOP",
            },
          ],
        }),
      };
      vi.mocked(http.request).mockResolvedValue(mockResponse);

      await provider.generateChatCompletion([{ role: "user", content: "Test" }], "models/gemini-pro");

      const callArgs = vi.mocked(http.request).mock.calls[0];
      const url = callArgs![0];
      // Should not double the prefix
      expect(url).not.toContain("/models/models/");
    });

    it("should include API key in query parameter", async () => {
      const mockResponse: HTTPResponse = {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {},
        body: JSON.stringify({
          candidates: [
            {
              content: {
                role: "model",
                parts: [{ text: "Response" }],
              },
              finishReason: "STOP",
            },
          ],
        }),
      };
      vi.mocked(http.request).mockResolvedValue(mockResponse);

      await provider.generateChatCompletion([{ role: "user", content: "Test" }], "gemini-pro");

      expect(http.request).toHaveBeenCalledWith(
        expect.stringContaining("key=test-gemini-key"),
        expect.any(Object)
      );
    });

    it("should map STOP finish reason to stop", async () => {
      const mockResponse: HTTPResponse = {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {},
        body: JSON.stringify({
          candidates: [
            {
              content: {
                role: "model",
                parts: [{ text: "Response" }],
              },
              finishReason: "STOP",
            },
          ],
        }),
      };
      vi.mocked(http.request).mockResolvedValue(mockResponse);

      const result = await provider.generateChatCompletion([{ role: "user", content: "Test" }], "gemini-pro");
      expect(result.metadata.finishReason).toBe("stop");
    });

    it("should map MAX_TOKENS finish reason to length", async () => {
      const mockResponse: HTTPResponse = {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {},
        body: JSON.stringify({
          candidates: [
            {
              content: {
                role: "model",
                parts: [{ text: "Response" }],
              },
              finishReason: "MAX_TOKENS",
            },
          ],
        }),
      };
      vi.mocked(http.request).mockResolvedValue(mockResponse);

      const result = await provider.generateChatCompletion([{ role: "user", content: "Test" }], "gemini-pro");
      expect(result.metadata.finishReason).toBe("length");
    });

    it("should handle errors with proper classification", async () => {
      const mockResponse: HTTPResponse = {
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        headers: {},
        body: JSON.stringify({
          error: {
            code: 401,
            message: "Invalid API key",
            status: "UNAUTHENTICATED",
          },
        }),
      };
      vi.mocked(http.request).mockResolvedValue(mockResponse);

      await expect(
        provider.generateChatCompletion([{ role: "user", content: "Test" }], "gemini-pro")
      ).rejects.toThrow(ProviderAuthError);
    });

    it("should extract retry-after from rate limit errors", async () => {
      const mockResponse: HTTPResponse = {
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        headers: { "retry-after": "90" },
        body: JSON.stringify({
          error: {
            code: 429,
            message: "Rate limit exceeded",
            status: "RESOURCE_EXHAUSTED",
          },
        }),
      };
      vi.mocked(http.request).mockResolvedValue(mockResponse);

      try {
        await provider.generateChatCompletion([{ role: "user", content: "Test" }], "gemini-pro");
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error).toBeInstanceOf(ProviderRateLimitError);
        if (error instanceof ProviderRateLimitError) {
          expect(error.retryAfter).toBe(90);
        }
      }
    });
  });

  describe("streamChatCompletion()", () => {
    it("should stream content chunks with Gemini format", async () => {
      const mockStream = (async function* () {
        yield JSON.stringify({
          candidates: [
            {
              content: {
                role: "model",
                parts: [{ text: "Hello" }],
              },
            },
          ],
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 2,
            totalTokenCount: 12,
          },
        });
        yield JSON.stringify({
          candidates: [
            {
              content: {
                role: "model",
                parts: [{ text: " world" }],
              },
            },
          ],
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 5,
            totalTokenCount: 15,
          },
        });
        yield JSON.stringify({
          candidates: [
            {
              content: {
                role: "model",
                parts: [{ text: "" }],
              },
              finishReason: "STOP",
            },
          ],
        });
      })();

      vi.mocked(http.stream).mockReturnValue(mockStream);

      const messages: ChatMessage[] = [{ role: "user", content: "Hello" }];
      const chunks = [];

      for await (const chunk of provider.streamChatCompletion(messages, "gemini-1.5-pro")) {
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
      expect(metadataChunk?.metadata?.model).toBe("gemini-1.5-pro");
      expect(metadataChunk?.metadata?.provider).toBe("gemini");
      expect(metadataChunk?.metadata?.finishReason).toBe("stop");
      expect(metadataChunk?.metadata?.usage).toEqual({
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      });
    });

    it("should use alt=sse parameter for streaming", async () => {
      const mockStream = (async function* () {
        yield JSON.stringify({
          candidates: [
            {
              content: {
                role: "model",
                parts: [{ text: "Test" }],
              },
            },
          ],
        });
      })();

      vi.mocked(http.stream).mockReturnValue(mockStream);

      await provider
        .streamChatCompletion([{ role: "user", content: "Hello" }], "gemini-pro")
        .next();

      expect(http.stream).toHaveBeenCalledWith(
        expect.stringContaining("alt=sse"),
        expect.any(Object)
      );
    });

    it("should pass abort signal to stream", async () => {
      const mockStream = (async function* () {
        yield JSON.stringify({
          candidates: [
            {
              content: {
                role: "model",
                parts: [{ text: "Test" }],
              },
            },
          ],
        });
      })();

      vi.mocked(http.stream).mockReturnValue(mockStream);

      const abortController = new AbortController();
      const messages: ChatMessage[] = [{ role: "user", content: "Hello" }];

      const generator = provider.streamChatCompletion(messages, "gemini-pro", {
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
          candidates: [
            {
              content: {
                role: "model",
                parts: [{ text: "Response" }],
              },
            },
          ],
        });
      })();

      vi.mocked(http.stream).mockReturnValue(mockStream);

      const messages: ChatMessage[] = [
        { role: "system", content: "You are helpful." },
        { role: "user", content: "Hello" },
      ];

      const chunks = [];
      for await (const chunk of provider.streamChatCompletion(messages, "gemini-pro")) {
        chunks.push(chunk);
      }

      const callArgs = vi.mocked(http.stream).mock.calls[0];
      const body = JSON.parse(callArgs![1]?.body as string);
      expect(body.systemInstruction).toEqual({
        role: "user",
        parts: [{ text: "You are helpful." }],
      });
    });

    it("should add models/ prefix for streaming", async () => {
      const mockStream = (async function* () {
        yield JSON.stringify({
          candidates: [
            {
              content: {
                role: "model",
                parts: [{ text: "Test" }],
              },
            },
          ],
        });
      })();

      vi.mocked(http.stream).mockReturnValue(mockStream);

      await provider
        .streamChatCompletion([{ role: "user", content: "Hello" }], "gemini-pro")
        .next();

      expect(http.stream).toHaveBeenCalledWith(
        expect.stringContaining("/models/gemini-pro:streamGenerateContent"),
        expect.any(Object)
      );
    });
  });

  describe("healthCheck()", () => {
    it("should use listModels for health check", async () => {
      const mockResponse: HTTPResponse = {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {},
        body: JSON.stringify({ models: [] }),
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
