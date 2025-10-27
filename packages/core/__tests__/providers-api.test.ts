import { describe, it, expect, beforeEach, vi } from "vitest";
import { ProvidersAPI, type CreateProviderInput, type UpdateProviderInput } from "../src/providers/providers-api.js";
import type { ProviderConfigRepository } from "../src/providers/provider-repository.type.js";
import type { ProviderConfig } from "../src/providers/provider-config.js";
import type { ProviderManager } from "../src/providers/provider-manager.js";

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

    it("should throw clear error when detection fails", async () => {
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

      await expect(api.create(input)).rejects.toThrow(
        "Unable to automatically detect provider type"
      );
      await expect(api.create(input)).rejects.toThrow(
        "Please specify the provider type explicitly"
      );
    });

    it("should wrap ProviderDetectionError in user-friendly message", async () => {
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
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("Unable to automatically detect provider type");
        expect((error as Error).message).toContain("Please specify the provider type explicitly");
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
});
