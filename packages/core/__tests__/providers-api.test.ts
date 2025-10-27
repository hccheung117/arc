import { describe, it, expect, beforeEach, vi } from "vitest";
import { ProvidersAPI, type CreateProviderInput, type UpdateProviderInput } from "../src/providers/providers-api.js";
import type { ProviderConfigRepository } from "../src/providers/provider-repository.type.js";
import type { ProviderConfig } from "../src/providers/provider-config.js";
import type { ProviderManager } from "../src/providers/provider-manager.js";
import { CoreProviderDetectionError } from "../src/shared/errors.js";

// Mock the provider detector module
vi.mock("@arc/ai/provider-detector.js", () => ({
  detectProviderType: vi.fn(),
  detectProviderTypeFromProbe: vi.fn(),
}));

// Mock the errors module
vi.mock("@arc/ai/errors.js", () => ({
  ProviderDetectionError: class ProviderDetectionError extends Error {
    public readonly attempts: Array<{
      vendor: string;
      method: string;
      path: string;
      statusCode: number | null;
      evidence: string;
    }>;
    public readonly isRetryable: boolean;

    constructor(
      message: string,
      options: {
        attempts: Array<{
          vendor: string;
          method: string;
          path: string;
          statusCode: number | null;
          evidence: string;
        }>;
        isRetryable: boolean;
      }
    ) {
      super(message);
      this.name = "ProviderDetectionError";
      this.attempts = options.attempts;
      this.isRetryable = options.isRetryable;
    }
  },
}));

import { detectProviderType, detectProviderTypeFromProbe } from "@arc/ai/provider-detector.js";
import { ProviderDetectionError } from "@arc/ai/errors.js";

/**
 * ProvidersAPI Tests
 *
 * These tests verify the ProvidersAPI orchestration logic
 * with mocked dependencies.
 */

describe("ProvidersAPI", () => {
  let api: ProvidersAPI;
  let mockRepository: ProviderConfigRepository;
  let mockManager: ProviderManager;

  beforeEach(() => {
    // Create mock repository
    mockRepository = {
      create: vi.fn(),
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

  describe("list", () => {
    it("should return all provider configs from repository", async () => {
      const configs: ProviderConfig[] = [
        {
          id: "1",
          name: "OpenAI",
          type: "openai",
          apiKey: "key1",
          baseUrl: "https://api.openai.com/v1",
          enabled: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: "2",
          name: "Anthropic",
          type: "anthropic",
          apiKey: "key2",
          baseUrl: "https://api.anthropic.com/v1",
          enabled: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      vi.mocked(mockRepository.findAll).mockResolvedValue(configs);

      const result = await api.list();
      expect(result).toEqual(configs);
      expect(mockRepository.findAll).toHaveBeenCalledOnce();
    });
  });

  describe("create", () => {
    it("should generate ID and timestamps", async () => {
      const input: CreateProviderInput = {
        name: "Test Provider",
        type: "openai",
        apiKey: "test-key",
        baseUrl: "https://api.openai.com/v1",
      };

      vi.mocked(mockRepository.create).mockImplementation(async (config) => config);

      const before = Date.now();
      const result = await api.create(input);
      const after = Date.now();

      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeGreaterThanOrEqual(before);
      expect(result.createdAt).toBeLessThanOrEqual(after);
      expect(result.updatedAt).toBe(result.createdAt);
    });

    it("should call repository.create with config", async () => {
      const input: CreateProviderInput = {
        name: "Test Provider",
        type: "openai",
        apiKey: "test-key",
        baseUrl: "https://api.openai.com/v1",
      };

      vi.mocked(mockRepository.create).mockImplementation(async (config) => config);

      await api.create(input);

      expect(mockRepository.create).toHaveBeenCalledOnce();
      const createdConfig = vi.mocked(mockRepository.create).mock.calls[0][0];
      expect(createdConfig.name).toBe(input.name);
      expect(createdConfig.type).toBe(input.type);
      expect(createdConfig.apiKey).toBe(input.apiKey);
      expect(createdConfig.baseUrl).toBe(input.baseUrl);
    });

    it("should default enabled to true", async () => {
      const input: CreateProviderInput = {
        name: "Test Provider",
        type: "openai",
        apiKey: "test-key",
        baseUrl: "https://api.openai.com/v1",
      };

      vi.mocked(mockRepository.create).mockImplementation(async (config) => config);

      const result = await api.create(input);
      expect(result.enabled).toBe(true);
    });

    it("should respect enabled when provided", async () => {
      const input: CreateProviderInput = {
        name: "Test Provider",
        type: "openai",
        apiKey: "test-key",
        baseUrl: "https://api.openai.com/v1",
        enabled: false,
      };

      vi.mocked(mockRepository.create).mockImplementation(async (config) => config);

      const result = await api.create(input);
      expect(result.enabled).toBe(false);
    });

    it("should handle optional fields", async () => {
      const input: CreateProviderInput = {
        name: "Test Provider",
        type: "openai",
        apiKey: "test-key",
        baseUrl: "https://api.openai.com/v1",
        customHeaders: { "X-Custom": "value" },
        defaultModel: "gpt-4",
      };

      vi.mocked(mockRepository.create).mockImplementation(async (config) => config);

      const result = await api.create(input);
      expect(result.customHeaders).toEqual({ "X-Custom": "value" });
      expect(result.defaultModel).toBe("gpt-4");
    });
  });

  describe("update", () => {
    const existingConfig: ProviderConfig = {
      id: "provider-1",
      name: "Old Name",
      type: "openai",
      apiKey: "old-key",
      baseUrl: "https://api.openai.com/v1",
      enabled: true,
      createdAt: Date.now() - 10000,
      updatedAt: Date.now() - 10000,
    };

    it("should update timestamps", async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(existingConfig);
      vi.mocked(mockRepository.update).mockImplementation(async (config) => config);

      const input: UpdateProviderInput = { name: "New Name" };
      const before = Date.now();
      const result = await api.update("provider-1", input);
      const after = Date.now();

      expect(result.updatedAt).toBeGreaterThanOrEqual(before);
      expect(result.updatedAt).toBeLessThanOrEqual(after);
      expect(result.updatedAt).toBeGreaterThan(existingConfig.updatedAt);
    });

    it("should call repository.update", async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(existingConfig);
      vi.mocked(mockRepository.update).mockImplementation(async (config) => config);

      const input: UpdateProviderInput = { name: "New Name" };
      await api.update("provider-1", input);

      expect(mockRepository.update).toHaveBeenCalledOnce();
    });

    it("should invalidate provider manager cache", async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(existingConfig);
      vi.mocked(mockRepository.update).mockImplementation(async (config) => config);

      const input: UpdateProviderInput = { name: "New Name" };
      await api.update("provider-1", input);

      expect(mockManager.invalidate).toHaveBeenCalledWith("provider-1");
    });

    it("should merge updates with existing config", async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(existingConfig);
      vi.mocked(mockRepository.update).mockImplementation(async (config) => config);

      const input: UpdateProviderInput = { name: "New Name" };
      const result = await api.update("provider-1", input);

      expect(result.name).toBe("New Name");
      expect(result.apiKey).toBe("old-key"); // Unchanged
      expect(result.type).toBe("openai"); // Unchanged
    });

    it("should throw for non-existent provider", async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(null);

      const input: UpdateProviderInput = { name: "New Name" };
      await expect(api.update("nonexistent", input)).rejects.toThrow("Provider nonexistent not found");
    });
  });

  describe("delete", () => {
    it("should call repository.delete", async () => {
      vi.mocked(mockRepository.delete).mockResolvedValue(true);

      await api.delete("provider-1");

      expect(mockRepository.delete).toHaveBeenCalledWith("provider-1");
    });

    it("should invalidate provider manager cache", async () => {
      vi.mocked(mockRepository.delete).mockResolvedValue(true);

      await api.delete("provider-1");

      expect(mockManager.invalidate).toHaveBeenCalledWith("provider-1");
    });

    it("should throw when provider not found", async () => {
      vi.mocked(mockRepository.delete).mockResolvedValue(false);

      await expect(api.delete("nonexistent")).rejects.toThrow("Provider nonexistent not found");
    });
  });

  describe("checkConnection", () => {
    const config: ProviderConfig = {
      id: "provider-1",
      name: "Test Provider",
      type: "openai",
      apiKey: "test-key",
      baseUrl: "https://api.openai.com/v1",
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    it("should get provider from manager and call checkConnection", async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(config);
      vi.mocked(mockManager.checkConnection).mockResolvedValue(true);

      const result = await api.checkConnection("provider-1");

      expect(result).toBe(true);
      expect(mockManager.checkConnection).toHaveBeenCalledWith(config);
    });

    it("should throw for non-existent provider", async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(null);

      await expect(api.checkConnection("nonexistent")).rejects.toThrow("Provider nonexistent not found");
    });

    it("should propagate provider errors", async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(config);
      vi.mocked(mockManager.checkConnection).mockRejectedValue(new Error("Invalid API key"));

      await expect(api.checkConnection("provider-1")).rejects.toThrow("Invalid API key");
    });
  });

  describe("auto-detection (Phase 8)", () => {
    beforeEach(() => {
      // Reset the mock before each test
      vi.mocked(detectProviderType).mockReset();
    });

    it("should call detectProviderType when type is 'auto'", async () => {
      const input: CreateProviderInput = {
        name: "Auto Provider",
        type: "auto",
        apiKey: "sk-ant-test",
        baseUrl: "https://api.anthropic.com/v1",
      };

      vi.mocked(detectProviderType).mockReturnValue("anthropic");
      vi.mocked(mockRepository.create).mockImplementation(async (config) => config);

      await api.create(input);

      expect(detectProviderType).toHaveBeenCalledWith({
        apiKey: input.apiKey,
        baseUrl: input.baseUrl,
      });
    });

    it("should use detected type to create provider", async () => {
      const input: CreateProviderInput = {
        name: "Auto Provider",
        type: "auto",
        apiKey: "sk-test",
        baseUrl: "https://api.openai.com/v1",
      };

      vi.mocked(detectProviderType).mockReturnValue("openai");
      vi.mocked(mockRepository.create).mockImplementation(async (config) => config);

      const result = await api.create(input);

      expect(result.type).toBe("openai");
      expect(mockRepository.create).toHaveBeenCalledOnce();
      const createdConfig = vi.mocked(mockRepository.create).mock.calls[0][0];
      expect(createdConfig.type).toBe("openai");
    });

    it("should bypass detection when type is explicit", async () => {
      const input: CreateProviderInput = {
        name: "Explicit Provider",
        type: "openai",
        apiKey: "sk-test",
        baseUrl: "https://api.openai.com/v1",
      };

      vi.mocked(mockRepository.create).mockImplementation(async (config) => config);

      const result = await api.create(input);

      expect(detectProviderType).not.toHaveBeenCalled();
      expect(result.type).toBe("openai");
    });

    it("should throw CoreProviderDetectionError when detection fails", async () => {
      const input: CreateProviderInput = {
        name: "Auto Provider",
        type: "auto",
        apiKey: "unknown-key-format",
        baseUrl: "https://custom.api.com",
      };

      // Phase 1 fails
      vi.mocked(detectProviderType).mockImplementation(() => {
        throw new ProviderDetectionError("Heuristic detection failed", {
          attempts: [],
          isRetryable: false,
        });
      });

      // Phase 2 also fails
      vi.mocked(detectProviderTypeFromProbe).mockImplementation(() => {
        return Promise.reject(
          new ProviderDetectionError("Network probe failed", {
            attempts: [
              {
                vendor: "openai",
                method: "GET",
                path: "/v1/models",
                statusCode: 404,
                evidence: "{}",
              },
            ],
            isRetryable: false,
          })
        );
      });

      await expect(api.create(input)).rejects.toThrow(CoreProviderDetectionError);
    });

    it("should wrap ProviderDetectionError in CoreProviderDetectionError with user-friendly message", async () => {
      const input: CreateProviderInput = {
        name: "Auto Provider",
        type: "auto",
        apiKey: "unknown",
        baseUrl: "https://custom.api.com",
      };

      // Phase 1 fails
      vi.mocked(detectProviderType).mockImplementation(() => {
        throw new ProviderDetectionError("Heuristic detection failed", {
          attempts: [],
          isRetryable: false,
        });
      });

      // Phase 2 also fails
      const originalError = new ProviderDetectionError("Detection failed: no match found", {
        attempts: [
          {
            vendor: "openai",
            method: "GET",
            path: "/v1/models",
            statusCode: 404,
            evidence: "{}",
          },
        ],
        isRetryable: false,
      });
      vi.mocked(detectProviderTypeFromProbe).mockImplementation(() => {
        return Promise.reject(originalError);
      });

      try {
        await api.create(input);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(CoreProviderDetectionError);

        const coreError = error as CoreProviderDetectionError;
        expect(coreError.isRetryable).toBe(false);
        expect(coreError.detectionAttempts).toHaveLength(1);
        expect(coreError.suggestedAction).toBe("manual_selection");
        expect(coreError.getUserMessage()).toContain("Unable to automatically detect provider type");
      }
    });

    it("should set isRetryable=true for network timeout errors", async () => {
      const input: CreateProviderInput = {
        name: "Auto Provider",
        type: "auto",
        apiKey: "unknown",
        baseUrl: "https://custom.api.com",
      };

      // Phase 1 fails
      vi.mocked(detectProviderType).mockImplementation(() => {
        throw new ProviderDetectionError("Heuristic detection failed", {
          attempts: [],
          isRetryable: false,
        });
      });

      // Phase 2 fails with timeout
      const timeoutError = new ProviderDetectionError("Network timeout", {
        attempts: [
          {
            vendor: "openai",
            method: "GET",
            path: "/v1/models",
            statusCode: null, // null indicates timeout
            evidence: "Network timeout",
          },
          {
            vendor: "anthropic",
            method: "GET",
            path: "/v1/models",
            statusCode: null,
            evidence: "Network timeout",
          },
          {
            vendor: "gemini",
            method: "GET",
            path: "/v1beta/models",
            statusCode: null,
            evidence: "Network timeout",
          },
        ],
        isRetryable: true,
      });
      vi.mocked(detectProviderTypeFromProbe).mockImplementation(() => {
        return Promise.reject(timeoutError);
      });

      try {
        await api.create(input);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(CoreProviderDetectionError);

        const coreError = error as CoreProviderDetectionError;
        expect(coreError.isRetryable).toBe(true);
        expect(coreError.suggestedAction).toBe("retry");
        expect(coreError.getUserMessage()).toContain("network issues");
      }
    });

    it("should rethrow non-ProviderDetectionError errors", async () => {
      const input: CreateProviderInput = {
        name: "Auto Provider",
        type: "auto",
        apiKey: "sk-test",
        baseUrl: "https://api.openai.com/v1",
      };

      const unexpectedError = new Error("Unexpected system error");
      vi.mocked(detectProviderType).mockImplementation(() => {
        throw unexpectedError;
      });

      await expect(api.create(input)).rejects.toThrow("Unexpected system error");
    });
  });

  describe("caching", () => {
    beforeEach(() => {
      vi.mocked(detectProviderType).mockReset();
      vi.mocked(detectProviderTypeFromProbe).mockReset();
    });

    it("should cache detection results and skip detection on second call", async () => {
      const input: CreateProviderInput = {
        name: "Auto Provider",
        type: "auto",
        apiKey: "sk-test123",
        baseUrl: "https://custom.api.com",
      };

      // Phase 1 fails, Phase 2 succeeds
      vi.mocked(detectProviderType).mockImplementation(() => {
        throw new ProviderDetectionError("Heuristic failed", {
          attempts: [],
          isRetryable: false,
        });
      });
      vi.mocked(detectProviderTypeFromProbe).mockResolvedValue("openai");
      vi.mocked(mockRepository.create).mockImplementation(async (config) => config);

      // First call - should perform detection
      await api.create(input);
      expect(detectProviderTypeFromProbe).toHaveBeenCalledTimes(1);

      // Second call with same credentials - should use cache
      await api.create(input);
      expect(detectProviderTypeFromProbe).toHaveBeenCalledTimes(1); // Still 1, not called again
    });

    it("should not cache heuristic-based detections", async () => {
      const input: CreateProviderInput = {
        name: "Auto Provider",
        type: "auto",
        apiKey: "sk-ant-test",
        baseUrl: "https://api.anthropic.com/v1",
      };

      vi.mocked(detectProviderType).mockReturnValue("anthropic");
      vi.mocked(mockRepository.create).mockImplementation(async (config) => config);

      // First call - heuristics succeed
      await api.create(input);
      expect(detectProviderType).toHaveBeenCalledTimes(1);

      // Second call - heuristics run again (not cached)
      await api.create(input);
      expect(detectProviderType).toHaveBeenCalledTimes(2);
    });

    it("should use different cache keys for different credentials", async () => {
      vi.mocked(detectProviderType).mockImplementation(() => {
        throw new ProviderDetectionError("Heuristic failed", {
          attempts: [],
          isRetryable: false,
        });
      });
      vi.mocked(detectProviderTypeFromProbe).mockResolvedValue("openai");
      vi.mocked(mockRepository.create).mockImplementation(async (config) => config);

      const input1: CreateProviderInput = {
        name: "Provider 1",
        type: "auto",
        apiKey: "key1",
        baseUrl: "https://api1.com",
      };

      const input2: CreateProviderInput = {
        name: "Provider 2",
        type: "auto",
        apiKey: "key2",
        baseUrl: "https://api2.com",
      };

      await api.create(input1);
      await api.create(input2);

      // Both should trigger detection (different cache keys)
      expect(detectProviderTypeFromProbe).toHaveBeenCalledTimes(2);
    });

    it("should invalidate cache when provider is updated with new apiKey", async () => {
      const existingConfig: ProviderConfig = {
        id: "provider-1",
        name: "Test Provider",
        type: "openai",
        apiKey: "old-key",
        baseUrl: "https://custom.api.com",
        enabled: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      vi.mocked(mockRepository.findById).mockResolvedValue(existingConfig);
      vi.mocked(mockRepository.update).mockImplementation(async (config) => config);

      // First, populate cache
      vi.mocked(detectProviderType).mockImplementation(() => {
        throw new ProviderDetectionError("Heuristic failed", {
          attempts: [],
          isRetryable: false,
        });
      });
      vi.mocked(detectProviderTypeFromProbe).mockResolvedValue("openai");
      vi.mocked(mockRepository.create).mockImplementation(async (config) => config);

      const createInput: CreateProviderInput = {
        name: "Test",
        type: "auto",
        apiKey: "old-key",
        baseUrl: "https://custom.api.com",
      };
      await api.create(createInput);

      // Update the provider with new API key
      const updateInput: UpdateProviderInput = {
        apiKey: "new-key",
      };
      await api.update("provider-1", updateInput);

      // Create again with old credentials - should not use cache (was invalidated)
      await api.create(createInput);
      expect(detectProviderTypeFromProbe).toHaveBeenCalledTimes(2);
    });

    it("should invalidate cache when provider is deleted", async () => {
      const existingConfig: ProviderConfig = {
        id: "provider-1",
        name: "Test Provider",
        type: "openai",
        apiKey: "test-key",
        baseUrl: "https://custom.api.com",
        enabled: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      vi.mocked(mockRepository.findById).mockResolvedValue(existingConfig);
      vi.mocked(mockRepository.delete).mockResolvedValue(true);

      // First, populate cache
      vi.mocked(detectProviderType).mockImplementation(() => {
        throw new ProviderDetectionError("Heuristic failed", {
          attempts: [],
          isRetryable: false,
        });
      });
      vi.mocked(detectProviderTypeFromProbe).mockResolvedValue("openai");
      vi.mocked(mockRepository.create).mockImplementation(async (config) => config);

      const createInput: CreateProviderInput = {
        name: "Test",
        type: "auto",
        apiKey: "test-key",
        baseUrl: "https://custom.api.com",
      };
      await api.create(createInput);
      expect(detectProviderTypeFromProbe).toHaveBeenCalledTimes(1);

      // Delete the provider
      await api.delete("provider-1");

      // Create again - should not use cache (was invalidated)
      await api.create(createInput);
      expect(detectProviderTypeFromProbe).toHaveBeenCalledTimes(2);
    });

    it("should allow manual cache clearing", async () => {
      const input: CreateProviderInput = {
        name: "Auto Provider",
        type: "auto",
        apiKey: "sk-test123",
        baseUrl: "https://custom.api.com",
      };

      vi.mocked(detectProviderType).mockImplementation(() => {
        throw new ProviderDetectionError("Heuristic failed", {
          attempts: [],
          isRetryable: false,
        });
      });
      vi.mocked(detectProviderTypeFromProbe).mockResolvedValue("openai");
      vi.mocked(mockRepository.create).mockImplementation(async (config) => config);

      // First call - populate cache
      await api.create(input);
      expect(detectProviderTypeFromProbe).toHaveBeenCalledTimes(1);

      // Clear cache manually
      api.clearDetectionCache();

      // Second call - should perform detection again
      await api.create(input);
      expect(detectProviderTypeFromProbe).toHaveBeenCalledTimes(2);
    });
  });
});
