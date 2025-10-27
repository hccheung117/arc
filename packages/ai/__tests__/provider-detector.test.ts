import { describe, it, expect } from "vitest";
import { detectProviderType } from "../src/provider-detector.js";
import { ProviderDetectionError } from "../src/errors.js";

/**
 * Provider Detector Tests
 *
 * Tests the automatic provider detection functionality using:
 * 1. Base URL heuristics
 * 2. API key format detection
 */

describe("Provider Detection", () => {

  describe("Base URL Detection", () => {
    it("should detect OpenAI from base URL", () => {
      const result = detectProviderType({
        apiKey: "test-key",
        baseUrl: "https://api.openai.com/v1",
      });

      expect(result).toBe("openai");
    });

    it("should detect OpenAI from base URL with trailing slash", () => {
      const result = detectProviderType({
        apiKey: "test-key",
        baseUrl: "https://api.openai.com/v1/",
      });

      expect(result).toBe("openai");
    });

    it("should detect OpenAI from base URL with custom path", () => {
      const result = detectProviderType({
        apiKey: "test-key",
        baseUrl: "https://api.openai.com/v1/custom",
      });

      expect(result).toBe("openai");
    });

    it("should detect Anthropic from base URL", () => {
      const result = detectProviderType({
        apiKey: "test-key",
        baseUrl: "https://api.anthropic.com/v1",
      });

      expect(result).toBe("anthropic");
    });

    it("should detect Anthropic from base URL with trailing slash", () => {
      const result = detectProviderType({
        apiKey: "test-key",
        baseUrl: "https://api.anthropic.com/v1/",
      });

      expect(result).toBe("anthropic");
    });

    it("should detect Gemini from base URL", () => {
      const result = detectProviderType({
        apiKey: "test-key",
        baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      });

      expect(result).toBe("gemini");
    });

    it("should detect Gemini from base URL with trailing slash", () => {
      const result = detectProviderType({
        apiKey: "test-key",
        baseUrl: "https://generativelanguage.googleapis.com/v1beta/",
      });

      expect(result).toBe("gemini");
    });

    it("should handle mixed case URLs", () => {
      const result = detectProviderType({
        apiKey: "test-key",
        baseUrl: "https://API.OPENAI.COM/v1",
      });

      expect(result).toBe("openai");
    });
  });

  describe("API Key Format Detection", () => {
    it("should detect OpenAI from sk- prefix", () => {
      const result = detectProviderType({
        apiKey: "sk-1234567890abcdefghijklmnop",
      });

      expect(result).toBe("openai");
    });

    it("should detect OpenAI from sk-proj- prefix", () => {
      const result = detectProviderType({
        apiKey: "sk-proj-1234567890abcdefghijklmnop",
      });

      expect(result).toBe("openai");
    });

    it("should detect Anthropic from sk-ant- prefix", () => {
      const result = detectProviderType({
        apiKey: "sk-ant-api03-1234567890abcdefghijklmnop",
      });

      expect(result).toBe("anthropic");
    });

    it("should detect Gemini from AIza prefix", () => {
      const result = detectProviderType({
        apiKey: "AIzaSyD1234567890abcdefghijklmnopqrs",
      });

      expect(result).toBe("gemini");
    });

    it("should prioritize Anthropic over OpenAI for sk-ant- prefix", () => {
      // sk-ant- keys should be detected as Anthropic, not OpenAI
      const result = detectProviderType({
        apiKey: "sk-ant-api03-test",
      });

      expect(result).toBe("anthropic");
    });
  });

  describe("Error Handling", () => {
    it("should throw ProviderDetectionError when all detection methods fail", () => {
      expect(() => {
        detectProviderType({
          apiKey: "unknown-format-key",
          baseUrl: "https://unknown-provider.com",
        });
      }).toThrow(ProviderDetectionError);
    });

    it("should throw ProviderDetectionError with descriptive message", () => {
      try {
        detectProviderType({
          apiKey: "unknown-format-key",
          baseUrl: "https://unknown-provider.com",
        });
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(ProviderDetectionError);
        expect((error as Error).message).toContain("Unable to detect provider type");
        expect((error as Error).message).toContain("Attempted:");
      }
    });

    it("should include attempted strategies in error message", () => {
      try {
        detectProviderType({
          apiKey: "unknown-format-key",
          baseUrl: "https://unknown-provider.com",
        });
      } catch (error) {
        const message = (error as Error).message;
        expect(message).toContain("Base URL heuristics");
        expect(message).toContain("API key format detection");
      }
    });

    it("should mark ProviderDetectionError as non-retryable", () => {
      try {
        detectProviderType({
          apiKey: "unknown-format-key",
          baseUrl: "https://unknown-provider.com",
        });
      } catch (error) {
        expect(error).toBeInstanceOf(ProviderDetectionError);
        expect((error as ProviderDetectionError).isRetryable).toBe(false);
      }
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty API key gracefully", () => {
      expect(() => {
        detectProviderType({
          apiKey: "",
        });
      }).toThrow(ProviderDetectionError);
    });

    it("should handle very long API keys", () => {
      expect(() => {
        detectProviderType({
          apiKey: "a".repeat(1000),
        });
      }).toThrow(ProviderDetectionError);
    });

    it("should handle special characters in API key", () => {
      expect(() => {
        detectProviderType({
          apiKey: "key-with-special-chars-!@#$%",
        });
      }).toThrow(ProviderDetectionError);
    });

    it("should handle invalid base URL format", () => {
      // Even with invalid URL, should fall back to key detection
      const result = detectProviderType({
        apiKey: "sk-1234567890",
        baseUrl: "not-a-valid-url",
      });

      expect(result).toBe("openai");
    });

    it("should work without baseUrl parameter", () => {
      const result = detectProviderType({
        apiKey: "sk-ant-test",
      });

      expect(result).toBe("anthropic");
    });
  });

  describe("Detection Priority", () => {
    it("should use baseUrl detection before key detection", () => {
      // Even though key looks like OpenAI, baseUrl should take precedence
      const result = detectProviderType({
        apiKey: "sk-test",
        baseUrl: "https://api.anthropic.com/v1",
      });

      expect(result).toBe("anthropic");
    });

    it("should use key detection when baseUrl doesn't match", () => {
      // Should fall back to key detection for custom proxies
      const result = detectProviderType({
        apiKey: "sk-ant-test",
        baseUrl: "https://custom-proxy.com",
      });

      expect(result).toBe("anthropic");
    });
  });
});
