/**
 * End-to-End Integration Test: Provider Auto-Detection
 *
 * This test uses real @arc/ai and @arc/core (no mocking),
 * only mocking HTTP fetch at the network boundary.
 *
 * Tests the complete flow:
 * 1. Heuristics fail → network probes run → provider detected
 * 2. All three vendor scenarios (OpenAI, Anthropic, Gemini)
 * 3. Error scenarios (timeouts, ambiguous failures)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ProvidersAPI } from "../../src/providers/providers-api.js";
import type { ProviderConfigRepository } from "../../src/providers/provider-repository.type.js";
import type { ProviderConfig } from "../../src/providers/provider-config.js";
import type { ProviderManager } from "../../src/providers/provider-manager.js";
import { CoreProviderDetectionError } from "../../src/shared/errors.js";

describe("Integration: Provider Auto-Detection", () => {
  let api: ProvidersAPI;
  let mockRepository: ProviderConfigRepository;
  let mockManager: ProviderManager;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    // Save original fetch
    originalFetch = globalThis.fetch;

    // Create mock repository
    mockRepository = {
      create: vi.fn().mockImplementation(async (config) => config),
      findById: vi.fn(),
      findAll: vi.fn(),
      findEnabled: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    // Create mock manager
    mockManager = {
      getProvider: vi.fn(),
      checkConnection: vi.fn(),
      invalidate: vi.fn(),
      clearCache: vi.fn(),
    } as unknown as ProviderManager;

    api = new ProvidersAPI(mockRepository, mockManager);
  });

  afterEach(() => {
    // Restore original fetch
    globalThis.fetch = originalFetch;
  });

  describe("OpenAI Detection", () => {
    it("should detect OpenAI from successful probe with valid schema", async () => {
      // Mock successful OpenAI response
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (typeof url === "string" && url.includes("/v1/models") && !url.includes("generativelanguage")) {
          return Promise.resolve({
            status: 200,
            json: () =>
              Promise.resolve({
                object: "list",
                data: [
                  { id: "gpt-4", object: "model", owned_by: "openai" },
                  { id: "gpt-3.5-turbo", object: "model", owned_by: "openai" },
                ],
              }),
          } as Response);
        }
        // Other probes fail
        return Promise.resolve({
          status: 404,
          json: () => Promise.resolve({ error: "Not found" }),
        } as Response);
      });

      const result = await api.create({
        name: "Custom Proxy",
        type: "auto",
        apiKey: "custom-key-12345",
        baseUrl: "https://custom-proxy.com",
      });

      expect(result.type).toBe("openai");
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "openai",
          apiKey: "custom-key-12345",
          baseUrl: "https://custom-proxy.com",
        })
      );
    });

    it("should detect OpenAI from error schema with 401", async () => {
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (typeof url === "string" && url.includes("/v1/models") && !url.includes("generativelanguage")) {
          return Promise.resolve({
            status: 401,
            json: () =>
              Promise.resolve({
                error: {
                  message: "Invalid API key provided",
                  type: "invalid_request_error",
                  param: null,
                  code: "invalid_api_key",
                },
              }),
          } as Response);
        }
        return Promise.resolve({
          status: 404,
          json: () => Promise.resolve({ error: "Not found" }),
        } as Response);
      });

      const result = await api.create({
        name: "OpenAI with invalid key",
        type: "auto",
        apiKey: "invalid-openai-key",
        baseUrl: "https://custom-proxy.com",
      });

      expect(result.type).toBe("openai");
    });
  });

  describe("Anthropic Detection", () => {
    it("should detect Anthropic from successful probe with valid schema", async () => {
      globalThis.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
        if (typeof url === "string" && url.includes("/v1/models")) {
          // Check if this is the Anthropic probe by looking for x-api-key header
          const headers = options?.headers as Record<string, string> | undefined;
          if (headers && headers["x-api-key"]) {
            return Promise.resolve({
              status: 200,
              json: () =>
                Promise.resolve({
                  data: [
                    { id: "claude-3-opus-20240229", type: "model" },
                    { id: "claude-3-sonnet-20240229", type: "model" },
                  ],
                  has_more: false,
                  first_id: "claude-3-opus-20240229",
                }),
            } as Response);
          }
        }
        return Promise.resolve({
          status: 404,
          json: () => Promise.resolve({ error: "Not found" }),
        } as Response);
      });

      const result = await api.create({
        name: "Custom Anthropic",
        type: "auto",
        apiKey: "custom-anthropic-key",
        baseUrl: "https://custom-proxy.com",
      });

      expect(result.type).toBe("anthropic");
    });

    it("should detect Anthropic from error schema with 401", async () => {
      globalThis.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
        if (typeof url === "string" && url.includes("/v1/models")) {
          const headers = options?.headers as Record<string, string> | undefined;
          if (headers && headers["x-api-key"]) {
            return Promise.resolve({
              status: 401,
              json: () =>
                Promise.resolve({
                  type: "error",
                  error: {
                    type: "authentication_error",
                    message: "Invalid API key",
                  },
                }),
            } as Response);
          }
        }
        return Promise.resolve({
          status: 404,
          json: () => Promise.resolve({ error: "Not found" }),
        } as Response);
      });

      const result = await api.create({
        name: "Anthropic with invalid key",
        type: "auto",
        apiKey: "invalid-anthropic-key",
        baseUrl: "https://custom-proxy.com",
      });

      expect(result.type).toBe("anthropic");
    });
  });

  describe("Gemini Detection", () => {
    it("should detect Gemini from successful probe with valid schema", async () => {
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (typeof url === "string" && url.includes("v1beta/models")) {
          return Promise.resolve({
            status: 200,
            json: () =>
              Promise.resolve({
                models: [
                  { name: "models/gemini-pro", displayName: "Gemini Pro" },
                  { name: "models/gemini-pro-vision", displayName: "Gemini Pro Vision" },
                ],
              }),
          } as Response);
        }
        return Promise.resolve({
          status: 404,
          json: () => Promise.resolve({ error: "Not found" }),
        } as Response);
      });

      const result = await api.create({
        name: "Custom Gemini",
        type: "auto",
        apiKey: "custom-gemini-key",
        baseUrl: "https://generativelanguage.googleapis.com",
      });

      expect(result.type).toBe("gemini");
    });

    it("should detect Gemini from error schema with 403", async () => {
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (typeof url === "string" && url.includes("v1beta/models")) {
          return Promise.resolve({
            status: 403,
            json: () =>
              Promise.resolve({
                error: {
                  code: 403,
                  message: "API key not valid. Please pass a valid API key.",
                  status: "PERMISSION_DENIED",
                },
              }),
          } as Response);
        }
        return Promise.resolve({
          status: 404,
          json: () => Promise.resolve({ error: "Not found" }),
        } as Response);
      });

      const result = await api.create({
        name: "Gemini with invalid key",
        type: "auto",
        apiKey: "invalid-gemini-key",
        baseUrl: "https://generativelanguage.googleapis.com",
      });

      expect(result.type).toBe("gemini");
    });
  });

  describe("Error Scenarios", () => {
    it("should throw CoreProviderDetectionError with isRetryable=true for network timeouts", async () => {
      // Mock all probes timing out
      globalThis.fetch = vi.fn().mockImplementation(() => {
        return new Promise((_, reject) => {
          const error = new Error("Network timeout");
          (error as Error & { name: string }).name = "AbortError";
          reject(error);
        });
      });

      await expect(
        api.create({
          name: "Timeout Test",
          type: "auto",
          apiKey: "test-key",
          baseUrl: "https://custom-proxy.com",
        })
      ).rejects.toThrow(CoreProviderDetectionError);

      try {
        await api.create({
          name: "Timeout Test",
          type: "auto",
          apiKey: "test-key",
          baseUrl: "https://custom-proxy.com",
        });
      } catch (error) {
        expect(error).toBeInstanceOf(CoreProviderDetectionError);
        const coreError = error as CoreProviderDetectionError;
        expect(coreError.isRetryable).toBe(true);
        expect(coreError.suggestedAction).toBe("retry");
        expect(coreError.detectionAttempts.length).toBe(3);
        expect(coreError.detectionAttempts.every((a) => a.statusCode === null)).toBe(true);
      }
    });

    it("should throw CoreProviderDetectionError with isRetryable=false for ambiguous failures", async () => {
      // Mock all probes returning generic 404
      globalThis.fetch = vi.fn().mockImplementation(() => {
        return Promise.resolve({
          status: 404,
          json: () => Promise.resolve({ message: "Not found" }),
        } as Response);
      });

      await expect(
        api.create({
          name: "Ambiguous Test",
          type: "auto",
          apiKey: "unknown-key",
          baseUrl: "https://custom-proxy.com",
        })
      ).rejects.toThrow(CoreProviderDetectionError);

      try {
        await api.create({
          name: "Ambiguous Test",
          type: "auto",
          apiKey: "unknown-key",
          baseUrl: "https://custom-proxy.com",
        });
      } catch (error) {
        expect(error).toBeInstanceOf(CoreProviderDetectionError);
        const coreError = error as CoreProviderDetectionError;
        expect(coreError.isRetryable).toBe(false);
        expect(coreError.suggestedAction).toBe("manual_selection");
        expect(coreError.detectionAttempts.length).toBe(3);
      }
    });
  });

  describe("Caching Integration", () => {
    it("should cache probe results across multiple create calls", async () => {
      const fetchSpy = vi.fn().mockImplementation((url: string) => {
        if (typeof url === "string" && url.includes("/v1/models") && !url.includes("generativelanguage")) {
          return Promise.resolve({
            status: 200,
            json: () =>
              Promise.resolve({
                object: "list",
                data: [{ id: "gpt-4", object: "model" }],
              }),
          } as Response);
        }
        return Promise.resolve({
          status: 404,
          json: () => Promise.resolve({ error: "Not found" }),
        } as Response);
      });
      globalThis.fetch = fetchSpy;

      // First call - should probe
      await api.create({
        name: "Provider 1",
        type: "auto",
        apiKey: "same-key",
        baseUrl: "https://same-proxy.com",
      });

      const firstCallCount = fetchSpy.mock.calls.length;
      expect(firstCallCount).toBeGreaterThan(0);

      // Second call with same credentials - should use cache
      await api.create({
        name: "Provider 2",
        type: "auto",
        apiKey: "same-key",
        baseUrl: "https://same-proxy.com",
      });

      // Fetch should not be called again
      expect(fetchSpy.mock.calls.length).toBe(firstCallCount);
    });
  });
});
