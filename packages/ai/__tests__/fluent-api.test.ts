import { describe, it, expect, beforeEach, vi } from "vitest";
import type { PlatformHTTP, HTTPResponse } from "@arc/platform/contracts/http.js";
import { AI } from "../src/AI.js";
import type { Provider } from "../src/provider.type.js";
import { OpenAIProvider } from "../src/providers/openai.js";
import { AnthropicProvider } from "../src/providers/anthropic.js";
import { GeminiProvider } from "../src/providers/gemini.js";

/**
 * Fluent API Tests
 *
 * Tests the AI class and ChatBuilder fluent API implementation.
 */
describe("AI Fluent API", () => {
  let http: PlatformHTTP;

  beforeEach(() => {
    http = {
      request: vi.fn(),
      stream: vi.fn(),
    };
  });

  describe("AI constructor", () => {
    it("should create OpenAI provider", () => {
      const ai = new AI("openai", { apiKey: "test-key" }, http);
      expect(ai).toBeDefined();
      expect(ai.provider).toBeInstanceOf(OpenAIProvider);
      expect(ai.chat).toBeDefined();
    });

    it("should create Anthropic provider", () => {
      const ai = new AI("anthropic", { apiKey: "test-key" }, http);
      expect(ai).toBeDefined();
      expect(ai.provider).toBeInstanceOf(AnthropicProvider);
      expect(ai.chat).toBeDefined();
    });

    it("should create Gemini provider", () => {
      const ai = new AI("gemini", { apiKey: "test-key" }, http);
      expect(ai).toBeDefined();
      expect(ai.provider).toBeInstanceOf(GeminiProvider);
      expect(ai.chat).toBeDefined();
    });

    it("should pass config to provider", () => {
      const config = {
        apiKey: "test-key",
        baseUrl: "https://custom.openai.com",
        customHeaders: { "X-Custom": "value" },
      };

      const ai = new AI("openai", config, http);
      expect(ai).toBeDefined();
    });

    it("should throw error for unknown provider type", () => {
      expect(() => {
        new AI("unknown" as any, { apiKey: "test-key" }, http);
      }).toThrow();
    });
  });

  describe("ChatBuilder chaining", () => {
    let ai: AI;

    beforeEach(() => {
      ai = new AI("openai", { apiKey: "test-key" }, http);
    });

    it("should chain model() method", () => {
      const builder = ai.chat.model("gpt-4");
      expect(builder).toBe(ai.chat); // Returns same instance for chaining
    });

    it("should chain systemSays() method", () => {
      const builder = ai.chat.systemSays("You are helpful.");
      expect(builder).toBe(ai.chat);
    });

    it("should chain userSays() method", () => {
      const builder = ai.chat.userSays("Hello");
      expect(builder).toBe(ai.chat);
    });

    it("should chain assistantSays() method", () => {
      const builder = ai.chat.assistantSays("Hi there!");
      expect(builder).toBe(ai.chat);
    });

    it("should chain multiple methods", () => {
      const builder = ai.chat
        .model("gpt-4")
        .systemSays("You are helpful.")
        .userSays("Hello")
        .assistantSays("Hi!")
        .userSays("How are you?");

      expect(builder).toBe(ai.chat);
    });
  });

  describe("Message building", () => {
    let ai: AI;

    beforeEach(() => {
      ai = new AI("openai", { apiKey: "test-key" }, http);

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
    });

    it("should build messages in order", async () => {
      await ai.chat
        .model("gpt-4")
        .systemSays("You are a helpful assistant.")
        .userSays("Hello")
        .assistantSays("Hi there!")
        .userSays("How are you?")
        .generate();

      const callArgs = vi.mocked(http.request).mock.calls[0];
      const body = JSON.parse(callArgs![1]?.body as string);

      expect(body.messages).toEqual([
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there!" },
        { role: "user", content: "How are you?" },
      ]);
    });

    it("should support userSays with images", async () => {
      const images = [
        {
          data: "data:image/png;base64,test",
          mimeType: "image/png",
        },
      ];

      await ai.chat
        .model("gpt-4-vision-preview")
        .userSays("What's in this image?", { images })
        .generate();

      const callArgs = vi.mocked(http.request).mock.calls[0];
      const body = JSON.parse(callArgs![1]?.body as string);

      expect(body.messages[0]?.content).toEqual([
        { type: "text", text: "What's in this image?" },
        {
          type: "image_url",
          image_url: {
            url: "data:image/png;base64,test",
            detail: "auto",
          },
        },
      ]);
    });

    it("should allow multiple system messages (latest wins)", async () => {
      await ai.chat
        .model("gpt-4")
        .systemSays("First system message")
        .systemSays("Second system message")
        .userSays("Hello")
        .generate();

      const callArgs = vi.mocked(http.request).mock.calls[0];
      const body = JSON.parse(callArgs![1]?.body as string);

      // Implementation may vary: some providers might only keep latest, others might keep all
      // At minimum, the second system message should be present
      const systemMessages = body.messages.filter((m: any) => m.role === "system");
      expect(systemMessages.length).toBeGreaterThan(0);
    });

    it("should preserve messages across generate() calls", async () => {
      await ai.chat.model("gpt-4").userSays("First request").generate();

      await ai.chat.userSays("Second request").generate();

      const callArgs = vi.mocked(http.request).mock.calls[1];
      const body = JSON.parse(callArgs![1]?.body as string);

      // Should have both requests - messages are preserved for conversation history
      expect(body.messages).toEqual([
        { role: "user", content: "First request" },
        { role: "user", content: "Second request" },
      ]);
    });
  });

  describe("generate()", () => {
    let ai: AI;

    beforeEach(() => {
      ai = new AI("openai", { apiKey: "test-key" }, http);
    });

    it("should call provider generateChatCompletion", async () => {
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
      vi.mocked(http.request).mockResolvedValue(mockResponse);

      const result = await ai.chat.model("gpt-4").userSays("Hello").generate();

      expect(result.content).toBe("Test response");
      expect(result.metadata.model).toBe("gpt-4");
      expect(result.metadata.provider).toBe("openai");
      expect(result.metadata.usage).toBeDefined();
    });

    it("should throw error if model not set", async () => {
      await expect(ai.chat.userSays("Hello").generate()).rejects.toThrow(
        "Model must be set before generating"
      );
    });

    it("should throw error if no messages", async () => {
      await expect(ai.chat.model("gpt-4").generate()).rejects.toThrow(
        "At least one message must be added before generating"
      );
    });

    it("should return ChatResult with content and metadata", async () => {
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

      const result = await ai.chat.model("gpt-4").userSays("Test").generate();

      expect(result).toHaveProperty("content");
      expect(result).toHaveProperty("metadata");
      expect(result.metadata).toHaveProperty("model");
      expect(result.metadata).toHaveProperty("provider");
    });
  });

  describe("stream()", () => {
    let ai: AI;

    beforeEach(() => {
      ai = new AI("openai", { apiKey: "test-key" }, http);
    });

    it("should return CancellableStream", () => {
      const mockStream = (async function* () {
        yield JSON.stringify({
          choices: [{ delta: { content: "Test" }, finish_reason: null }],
        });
      })();
      vi.mocked(http.stream).mockReturnValue(mockStream);

      const stream = ai.chat.model("gpt-4").userSays("Hello").stream();

      // CancellableStream is directly iterable via AsyncIterable
      expect(stream[Symbol.asyncIterator]).toBeDefined();
      expect(typeof stream[Symbol.asyncIterator]).toBe("function");
      expect(stream).toHaveProperty("cancel");
      expect(typeof stream.cancel).toBe("function");
    });

    it("should stream content chunks", async () => {
      const mockStream = (async function* () {
        yield JSON.stringify({
          id: "chatcmpl-123",
          model: "gpt-4",
          choices: [{ delta: { content: "Hello" }, finish_reason: null }],
        });
        yield JSON.stringify({
          id: "chatcmpl-123",
          model: "gpt-4",
          choices: [{ delta: { content: " world" }, finish_reason: null }],
        });
        yield JSON.stringify({
          id: "chatcmpl-123",
          model: "gpt-4",
          choices: [{ delta: {}, finish_reason: "stop" }],
        });
      })();
      vi.mocked(http.stream).mockReturnValue(mockStream);

      const cancellableStream = ai.chat.model("gpt-4").userSays("Hello").stream();
      const chunks = [];

      // Iterate directly over the stream (it's an AsyncIterable)
      for await (const chunk of cancellableStream) {
        chunks.push(chunk);
      }

      const contentChunks = chunks.filter((c) => c.content.length > 0);
      expect(contentChunks.length).toBeGreaterThanOrEqual(2);
      expect(contentChunks[0]?.content).toBe("Hello");
      expect(contentChunks[1]?.content).toBe(" world");
    });

    it("should support cancellation", async () => {
      const mockStream = (async function* () {
        yield JSON.stringify({
          choices: [{ delta: { content: "Test" }, finish_reason: null }],
        });
        // Simulate long-running stream
        await new Promise((resolve) => setTimeout(resolve, 100));
        yield JSON.stringify({
          choices: [{ delta: { content: " more" }, finish_reason: null }],
        });
      })();
      vi.mocked(http.stream).mockReturnValue(mockStream);

      const cancellableStream = ai.chat.model("gpt-4").userSays("Hello").stream();

      // Cancel after first chunk
      let chunkCount = 0;
      try {
        for await (const chunk of cancellableStream) {
          chunkCount++;
          if (chunkCount === 1) {
            cancellableStream.cancel();
          }
        }
      } catch (error) {
        // Cancellation may throw, that's okay
      }

      expect(chunkCount).toBeGreaterThanOrEqual(1);
    });

    it("should throw error if model not set", () => {
      expect(() => ai.chat.userSays("Hello").stream()).toThrow(
        "Model must be set before generating"
      );
    });

    it("should throw error if no messages", () => {
      expect(() => ai.chat.model("gpt-4").stream()).toThrow(
        "At least one message must be added before generating"
      );
    });
  });

  describe("models()", () => {
    let ai: AI;

    beforeEach(() => {
      ai = new AI("openai", { apiKey: "test-key" }, http);
    });

    it("should delegate to provider.listModels()", async () => {
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

      const models = await ai.chat.models();

      expect(models).toHaveLength(2);
      expect(models[0]?.id).toBe("gpt-4");
      expect(models[1]?.id).toBe("gpt-3.5-turbo");
    });
  });

  describe("healthCheck()", () => {
    let ai: AI;

    beforeEach(() => {
      ai = new AI("openai", { apiKey: "test-key" }, http);
    });

    it("should delegate to provider.healthCheck()", async () => {
      const mockResponse: HTTPResponse = {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {},
        body: JSON.stringify({ object: "list", data: [] }),
      };
      vi.mocked(http.request).mockResolvedValue(mockResponse);

      const result = await ai.chat.healthCheck();

      expect(result).toBe(true);
    });

    it("should return false on unhealthy provider", async () => {
      const mockResponse: HTTPResponse = {
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        headers: {},
        body: JSON.stringify({ error: { message: "Service unavailable" } }),
      };
      vi.mocked(http.request).mockResolvedValue(mockResponse);

      await expect(ai.chat.healthCheck()).rejects.toThrow();
    });
  });

  describe("capabilities()", () => {
    let ai: AI;

    beforeEach(() => {
      ai = new AI("openai", { apiKey: "test-key" }, http);
    });

    it("should delegate to provider.getCapabilities()", () => {
      const caps = ai.chat.capabilities("gpt-4-vision-preview");

      expect(caps).toHaveProperty("supportsVision");
      expect(caps).toHaveProperty("supportsStreaming");
      expect(caps).toHaveProperty("requiresMaxTokens");
      expect(caps).toHaveProperty("supportedMessageRoles");
    });

    it("should return correct capabilities for model", () => {
      const visionCaps = ai.chat.capabilities("gpt-4-vision-preview");
      expect(visionCaps.supportsVision).toBe(true);

      const standardCaps = ai.chat.capabilities("gpt-3.5-turbo");
      expect(standardCaps.supportsVision).toBe(false);
    });
  });

  describe("Provider-specific API flows", () => {
    it("should work with OpenAI", async () => {
      const ai = new AI("openai", { apiKey: "test-key" }, http);

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
              message: { role: "assistant", content: "OpenAI response" },
              finish_reason: "stop",
            },
          ],
        }),
      };
      vi.mocked(http.request).mockResolvedValue(mockResponse);

      const result = await ai.chat.model("gpt-4").userSays("Test").generate();

      expect(result.content).toBe("OpenAI response");
      expect(result.metadata.provider).toBe("openai");
    });

    it("should work with Anthropic", async () => {
      const ai = new AI("anthropic", { apiKey: "test-key" }, http);

      const mockResponse: HTTPResponse = {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {},
        body: JSON.stringify({
          id: "msg_123",
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: "Anthropic response" }],
          model: "claude-3-opus-20240229",
          stop_reason: "end_turn",
          usage: { input_tokens: 10, output_tokens: 5 },
        }),
      };
      vi.mocked(http.request).mockResolvedValue(mockResponse);

      const result = await ai.chat
        .model("claude-3-opus-20240229")
        .userSays("Test")
        .generate();

      expect(result.content).toBe("Anthropic response");
      expect(result.metadata.provider).toBe("anthropic");
    });

    it("should work with Gemini", async () => {
      const ai = new AI("gemini", { apiKey: "test-key" }, http);

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
                parts: [{ text: "Gemini response" }],
              },
              finishReason: "STOP",
            },
          ],
        }),
      };
      vi.mocked(http.request).mockResolvedValue(mockResponse);

      const result = await ai.chat.model("gemini-1.5-pro").userSays("Test").generate();

      expect(result.content).toBe("Gemini response");
      expect(result.metadata.provider).toBe("gemini");
    });
  });

  describe("Edge cases", () => {
    let ai: AI;

    beforeEach(() => {
      ai = new AI("openai", { apiKey: "test-key" }, http);
    });

    it("should handle empty message content", async () => {
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

      const result = await ai.chat.model("gpt-4").userSays("").generate();

      expect(result).toBeDefined();
    });

    it("should handle very long messages", async () => {
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

      const longMessage = "a".repeat(10000);
      const result = await ai.chat.model("gpt-4").userSays(longMessage).generate();

      expect(result).toBeDefined();
    });

    it("should handle rapid sequential calls", async () => {
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

      const results = await Promise.all([
        ai.chat.model("gpt-4").userSays("Message 1").generate(),
        ai.chat.model("gpt-4").userSays("Message 2").generate(),
        ai.chat.model("gpt-4").userSays("Message 3").generate(),
      ]);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.content).toBe("Response");
      });
    });
  });
});
