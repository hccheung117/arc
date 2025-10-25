import { describe, it, expect, beforeEach } from "vitest";
import type { IProviderConfigRepository } from "../src/providers/provider-repository.type.js";
import { InMemoryProviderConfigRepository } from "../src/providers/provider-repository-memory.js";
import { SQLiteProviderConfigRepository } from "../src/providers/provider-repository-sqlite.js";
import type { ProviderConfig } from "../src/providers/provider-config.js";
import type { IPlatformDatabase } from "@arc/platform";

/**
 * Provider Config Repository Contract Tests
 */

function createMockDatabase(): IPlatformDatabase {
  const store = new Map<string, {
    id: string;
    name: string;
    provider_type: string;
    api_key: string;
    base_url: string | null;
    custom_headers: string | null;
    is_active: 0 | 1;
    created_at: number;
    updated_at: number;
  }>();

  return {
    async init() {},
    async close() {},
    async query(sql: string, params?: unknown[]) {
      if (sql.includes("WHERE id = ?")) {
        const id = params?.[0] as string;
        const row = store.get(id);
        return { rows: row ? [row] : [] };
      }
      if (sql.includes("WHERE is_active = 1")) {
        const rows = Array.from(store.values()).filter(r => r.is_active === 1);
        return { rows };
      }
      if (sql.includes("SELECT * FROM provider_connections")) {
        return { rows: Array.from(store.values()) };
      }
      return { rows: [] };
    },
    async exec(sql: string, params?: unknown[]) {
      if (sql.includes("INSERT INTO provider_connections")) {
        const [id, name, provider_type, api_key, base_url, custom_headers, is_active, created_at, updated_at] = params as any[];
        store.set(id, { id, name, provider_type, api_key, base_url, custom_headers, is_active, created_at, updated_at });
        return { rowsAffected: 1 };
      }
      if (sql.includes("UPDATE provider_connections")) {
        const [name, api_key, base_url, custom_headers, is_active, updated_at, id] = params as any[];
        const existing = store.get(id);
        if (existing) {
          store.set(id, { ...existing, name, api_key, base_url, custom_headers, is_active, updated_at });
          return { rowsAffected: 1 };
        }
        return { rowsAffected: 0 };
      }
      if (sql.includes("DELETE FROM provider_connections")) {
        const id = params?.[0] as string;
        const had = store.has(id);
        store.delete(id);
        return { rowsAffected: had ? 1 : 0 };
      }
      return { rowsAffected: 0 };
    },
    async transaction(fn: () => Promise<void>) {
      await fn();
    },
  };
}

describe.each([
  { name: "InMemoryProviderConfigRepository", factory: () => new InMemoryProviderConfigRepository() },
  { name: "SQLiteProviderConfigRepository", factory: () => new SQLiteProviderConfigRepository(createMockDatabase()) },
])("$name", ({ factory }) => {
  let repo: IProviderConfigRepository;

  beforeEach(() => {
    repo = factory();
  });

  const createConfig = (overrides: Partial<ProviderConfig> = {}): ProviderConfig => ({
    id: `provider-${Date.now()}`,
    name: "Test Provider",
    type: "openai",
    apiKey: "test-key",
    baseUrl: "https://api.openai.com/v1",
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  });

  describe("create", () => {
    it("should create a new provider config", async () => {
      const config = createConfig();
      const result = await repo.create(config);
      expect(result).toEqual(config);
    });

    it("should store config with all properties", async () => {
      const config = createConfig({
        customHeaders: { "X-Custom": "value" },
      });
      await repo.create(config);
      const found = await repo.findById(config.id);
      expect(found).toEqual(config);
    });

    it("should handle config without optional properties", async () => {
      const config = createConfig();
      delete (config as any).customHeaders;
      delete (config as any).defaultModel;
      await repo.create(config);
      const found = await repo.findById(config.id);
      expect(found?.id).toBe(config.id);
    });
  });

  describe("findById", () => {
    it("should return null for non-existent id", async () => {
      const result = await repo.findById("nonexistent");
      expect(result).toBeNull();
    });

    it("should return config for existing id", async () => {
      const config = createConfig();
      await repo.create(config);
      const result = await repo.findById(config.id);
      expect(result).toEqual(config);
    });
  });

  describe("findAll", () => {
    it("should return empty array when no configs exist", async () => {
      const result = await repo.findAll();
      expect(result).toEqual([]);
    });

    it("should return all configs", async () => {
      const config1 = createConfig({ id: "1" });
      const config2 = createConfig({ id: "2" });
      await repo.create(config1);
      await repo.create(config2);

      const result = await repo.findAll();
      expect(result).toHaveLength(2);
      expect(result).toContainEqual(config1);
      expect(result).toContainEqual(config2);
    });
  });

  describe("findEnabled", () => {
    it("should return only enabled configs", async () => {
      const enabled1 = createConfig({ id: "1", enabled: true });
      const disabled = createConfig({ id: "2", enabled: false });
      const enabled2 = createConfig({ id: "3", enabled: true });

      await repo.create(enabled1);
      await repo.create(disabled);
      await repo.create(enabled2);

      const result = await repo.findEnabled();
      expect(result).toHaveLength(2);
      expect(result.every(c => c.enabled)).toBe(true);
    });

    it("should return empty array when no enabled configs", async () => {
      const disabled = createConfig({ enabled: false });
      await repo.create(disabled);
      const result = await repo.findEnabled();
      expect(result).toEqual([]);
    });
  });

  describe("update", () => {
    it("should update existing config", async () => {
      const config = createConfig();
      await repo.create(config);

      const updated = { ...config, name: "Updated Name", apiKey: "new-key" };
      const result = await repo.update(updated);
      expect(result.name).toBe("Updated Name");
      expect(result.apiKey).toBe("new-key");

      const found = await repo.findById(config.id);
      expect(found?.name).toBe("Updated Name");
    });

    it("should throw error for non-existent config", async () => {
      const config = createConfig();
      await expect(repo.update(config)).rejects.toThrow();
    });

    it("should update optional fields", async () => {
      const config = createConfig();
      await repo.create(config);

      const updated = { ...config, customHeaders: { "X-New": "header" } };
      await repo.update(updated);

      const found = await repo.findById(config.id);
      expect(found?.customHeaders).toEqual({ "X-New": "header" });
    });
  });

  describe("delete", () => {
    it("should return false for non-existent config", async () => {
      const result = await repo.delete("nonexistent");
      expect(result).toBe(false);
    });

    it("should delete existing config and return true", async () => {
      const config = createConfig();
      await repo.create(config);

      const result = await repo.delete(config.id);
      expect(result).toBe(true);
      expect(await repo.findById(config.id)).toBeNull();
    });

    it("should not affect other configs", async () => {
      const config1 = createConfig({ id: "1" });
      const config2 = createConfig({ id: "2" });
      await repo.create(config1);
      await repo.create(config2);

      await repo.delete(config1.id);
      expect(await repo.findById(config2.id)).toEqual(config2);
    });
  });
});
