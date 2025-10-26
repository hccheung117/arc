import { describe, it, expect, beforeEach, vi } from "vitest";
import { ProvidersAPI, type CreateProviderInput, type UpdateProviderInput } from "../src/providers/providers-api.js";
import type { ProviderConfigRepository } from "../src/providers/provider-repository.type.js";
import type { ProviderConfig } from "../src/providers/provider-config.js";
import type { ProviderManager } from "../src/providers/provider-manager.js";

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
});
