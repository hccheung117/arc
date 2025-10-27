import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { detectProviderType, detectProviderTypeFromProbe } from "../src/provider-detector.js";
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

  describe("Network Probing (detectProviderTypeFromProbe)", () => {
    let originalFetch: typeof globalThis.fetch;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    describe("Valid Keys (200 Success Responses)", () => {
      it("should detect OpenAI from successful probe with valid schema", async () => {
        // Mock successful OpenAI response
        globalThis.fetch = vi.fn().mockImplementation((url: string) => {
          if (url.includes('/v1/models') && !url.includes('generativelanguage')) {
            // Check for OpenAI auth header (not Anthropic's x-api-key)
            return Promise.resolve({
              status: 200,
              json: () => Promise.resolve({
                object: "list",
                data: [
                  { id: "gpt-4", object: "model", owned_by: "openai" }
                ]
              })
            } as Response);
          }
          // Other probes fail
          return Promise.resolve({
            status: 404,
            json: () => Promise.resolve({ error: "Not found" })
          } as Response);
        });

        const result = await detectProviderTypeFromProbe({
          apiKey: "test-key",
          baseUrl: "https://custom-proxy.com"
        });

        expect(result).toBe("openai");
      });

      it("should detect Anthropic from successful probe with valid schema", async () => {
        // Mock successful Anthropic response
        globalThis.fetch = vi.fn().mockImplementation((url: string) => {
          if (url.includes('/v1/models')) {
            // Anthropic-specific response
            return Promise.resolve({
              status: 200,
              json: () => Promise.resolve({
                data: [
                  { id: "claude-3-opus", type: "model" }
                ],
                has_more: false,
                first_id: "claude-3-opus"
              })
            } as Response);
          }
          // Other probes fail
          return Promise.resolve({
            status: 404,
            json: () => Promise.resolve({ error: "Not found" })
          } as Response);
        });

        const result = await detectProviderTypeFromProbe({
          apiKey: "test-key",
          baseUrl: "https://custom-proxy.com"
        });

        expect(result).toBe("anthropic");
      });

      it("should detect Gemini from successful probe with valid schema", async () => {
        // Mock successful Gemini response
        globalThis.fetch = vi.fn().mockImplementation((url: string) => {
          if (url.includes('generativelanguage')) {
            return Promise.resolve({
              status: 200,
              json: () => Promise.resolve({
                models: [
                  { name: "models/gemini-pro", displayName: "Gemini Pro" }
                ]
              })
            } as Response);
          }
          // Other probes fail
          return Promise.resolve({
            status: 404,
            json: () => Promise.resolve({ error: "Not found" })
          } as Response);
        });

        const result = await detectProviderTypeFromProbe({
          apiKey: "test-key",
          baseUrl: "https://generativelanguage.googleapis.com"
        });

        expect(result).toBe("gemini");
      });
    });

    describe("Invalid Keys (401 Error Responses)", () => {
      it("should detect OpenAI from error schema with 401", async () => {
        globalThis.fetch = vi.fn().mockImplementation((url: string) => {
          if (url.includes('/v1/models') && !url.includes('generativelanguage')) {
            return Promise.resolve({
              status: 401,
              json: () => Promise.resolve({
                error: {
                  message: "Invalid API key",
                  type: "invalid_request_error",
                  param: null,
                  code: "invalid_api_key"
                }
              })
            } as Response);
          }
          return Promise.resolve({
            status: 404,
            json: () => Promise.resolve({ error: "Not found" })
          } as Response);
        });

        const result = await detectProviderTypeFromProbe({
          apiKey: "invalid-key",
          baseUrl: "https://custom-proxy.com"
        });

        expect(result).toBe("openai");
      });

      it("should detect Anthropic from error schema with 401", async () => {
        globalThis.fetch = vi.fn().mockImplementation((url: string, options: RequestInit | undefined) => {
          if (url.includes('/v1/models') && !url.includes('generativelanguage')) {
            // Check if this is the Anthropic probe by looking for x-api-key header
            const headers = options?.headers as Record<string, string>;
            if (headers && headers['x-api-key']) {
              return Promise.resolve({
                status: 401,
                json: () => Promise.resolve({
                  type: "error",
                  error: {
                    type: "authentication_error",
                    message: "Invalid API key"
                  }
                })
              } as Response);
            }
          }
          return Promise.resolve({
            status: 404,
            json: () => Promise.resolve({ error: "Not found" })
          } as Response);
        });

        const result = await detectProviderTypeFromProbe({
          apiKey: "invalid-key",
          baseUrl: "https://custom-proxy.com"
        });

        expect(result).toBe("anthropic");
      });

      it("should detect Gemini from error schema with 403", async () => {
        globalThis.fetch = vi.fn().mockImplementation((url: string) => {
          if (url.includes('generativelanguage')) {
            return Promise.resolve({
              status: 403,
              json: () => Promise.resolve({
                error: {
                  code: 403,
                  message: "API key not valid",
                  status: "PERMISSION_DENIED"
                }
              })
            } as Response);
          }
          return Promise.resolve({
            status: 404,
            json: () => Promise.resolve({ error: "Not found" })
          } as Response);
        });

        const result = await detectProviderTypeFromProbe({
          apiKey: "invalid-key",
          baseUrl: "https://generativelanguage.googleapis.com"
        });

        expect(result).toBe("gemini");
      });
    });

    describe("Network Timeouts", () => {
      it("should throw ProviderDetectionError with isRetryable=true when all probes timeout", async () => {
        // Mock all probes timing out
        globalThis.fetch = vi.fn().mockImplementation(() => {
          return new Promise((_, reject) => {
            const error = new Error("Network timeout");
            (error as Error & { name: string }).name = "AbortError";
            reject(error);
          });
        });

        try {
          await detectProviderTypeFromProbe({
            apiKey: "test-key",
            baseUrl: "https://custom-proxy.com"
          });
          expect(true).toBe(false); // Should not reach here
        } catch (error) {
          expect(error).toBeInstanceOf(ProviderDetectionError);
          expect((error as ProviderDetectionError).isRetryable).toBe(true);
          expect((error as ProviderDetectionError).attempts.length).toBe(3);
          expect((error as ProviderDetectionError).attempts.every(a => a.statusCode === null)).toBe(true);
        }
      });

      it("should include timeout evidence in error attempts", async () => {
        globalThis.fetch = vi.fn().mockImplementation(() => {
          return new Promise((_, reject) => {
            const error = new Error("Network timeout");
            (error as Error & { name: string }).name = "AbortError";
            reject(error);
          });
        });

        try {
          await detectProviderTypeFromProbe({
            apiKey: "test-key",
            baseUrl: "https://custom-proxy.com"
          });
        } catch (error) {
          const attempts = (error as ProviderDetectionError).attempts;
          expect(attempts.some(a => a.evidence.includes("timeout"))).toBe(true);
        }
      });
    });

    describe("Ambiguous Failures", () => {
      it("should throw ProviderDetectionError with isRetryable=false for generic 404s", async () => {
        // Mock all probes returning generic 404
        globalThis.fetch = vi.fn().mockImplementation(() => {
          return Promise.resolve({
            status: 404,
            json: () => Promise.resolve({ message: "Not found" })
          } as Response);
        });

        try {
          await detectProviderTypeFromProbe({
            apiKey: "test-key",
            baseUrl: "https://custom-proxy.com"
          });
          expect(true).toBe(false); // Should not reach here
        } catch (error) {
          expect(error).toBeInstanceOf(ProviderDetectionError);
          expect((error as ProviderDetectionError).isRetryable).toBe(false);
          expect((error as ProviderDetectionError).attempts.length).toBe(3);
        }
      });

      it("should collect evidence from all failed probes", async () => {
        let probeCount = 0;
        globalThis.fetch = vi.fn().mockImplementation(() => {
          probeCount++;
          return Promise.resolve({
            status: 404,
            json: () => Promise.resolve({ message: `Not found ${probeCount}` })
          } as Response);
        });

        try {
          await detectProviderTypeFromProbe({
            apiKey: "test-key",
            baseUrl: "https://custom-proxy.com"
          });
        } catch (error) {
          const attempts = (error as ProviderDetectionError).attempts;
          expect(attempts.length).toBe(3);
          expect(attempts.map(a => a.vendor).sort()).toEqual(["anthropic", "gemini", "openai"]);
        }
      });
    });

    describe("Input Normalization", () => {
      it("should normalize baseUrl by removing trailing slashes", async () => {
        globalThis.fetch = vi.fn().mockImplementation((url: string) => {
          // Ensure no double slashes in path (but allow https://)
          const pathPart = url.replace(/^https?:\/\//, '');
          expect(pathPart).not.toMatch(/\/\//);

          if (url.includes('/v1/models') && !url.includes('generativelanguage')) {
            return Promise.resolve({
              status: 200,
              json: () => Promise.resolve({
                object: "list",
                data: [{ id: "gpt-4", object: "model" }]
              })
            } as Response);
          }
          return Promise.resolve({
            status: 404,
            json: () => Promise.resolve({})
          } as Response);
        });

        await detectProviderTypeFromProbe({
          apiKey: "test-key",
          baseUrl: "https://custom-proxy.com///"
        });
      });

      it("should add https:// scheme if missing", async () => {
        globalThis.fetch = vi.fn().mockImplementation((url: string) => {
          expect(url).toMatch(/^https:\/\//);

          if (url.includes('/v1/models') && !url.includes('generativelanguage')) {
            return Promise.resolve({
              status: 200,
              json: () => Promise.resolve({
                object: "list",
                data: []
              })
            } as Response);
          }
          return Promise.resolve({
            status: 404,
            json: () => Promise.resolve({})
          } as Response);
        });

        await detectProviderTypeFromProbe({
          apiKey: "test-key",
          baseUrl: "custom-proxy.com"
        });
      });

      it("should trim whitespace from API key and baseUrl", async () => {
        globalThis.fetch = vi.fn().mockImplementation((url: string) => {
          // Ensure no whitespace in URL
          expect(url).not.toMatch(/\s/);

          if (url.includes('/v1/models') && !url.includes('generativelanguage')) {
            return Promise.resolve({
              status: 200,
              json: () => Promise.resolve({
                object: "list",
                data: []
              })
            } as Response);
          }
          return Promise.resolve({
            status: 404,
            json: () => Promise.resolve({})
          } as Response);
        });

        await detectProviderTypeFromProbe({
          apiKey: "  test-key  ",
          baseUrl: "  https://custom-proxy.com  "
        });
      });
    });

    describe("API Key Redaction", () => {
      it("should redact API keys from error evidence", async () => {
        const testKey = "sk-test1234567890";

        globalThis.fetch = vi.fn().mockImplementation(() => {
          return Promise.resolve({
            status: 401,
            json: () => Promise.resolve({
              message: `Invalid key: ${testKey}`
            })
          } as Response);
        });

        try {
          await detectProviderTypeFromProbe({
            apiKey: testKey,
            baseUrl: "https://custom-proxy.com"
          });
        } catch (error) {
          const attempts = (error as ProviderDetectionError).attempts;
          expect(attempts.every(a => !a.evidence.includes(testKey))).toBe(true);
          expect(attempts.some(a => a.evidence.includes("[REDACTED]"))).toBe(true);
        }
      });
    });
  });
});
