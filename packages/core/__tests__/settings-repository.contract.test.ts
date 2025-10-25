import { describe, it, expect, beforeEach } from "vitest";
import type { ISettingsRepository } from "../src/settings/settings-repository.type.js";
import { InMemorySettingsRepository } from "../src/settings/settings-repository-memory.js";
import { SQLiteSettingsRepository } from "../src/settings/settings-repository-sqlite.js";
import type { IPlatformDatabase } from "@arc/platform";

/**
 * Settings Repository Contract Tests
 *
 * These tests ensure both in-memory and SQLite implementations
 * satisfy the ISettingsRepository contract.
 */

/**
 * Create a mock in-memory database for testing SQLite repository
 */
function createMockDatabase(): IPlatformDatabase {
  const store = new Map<string, { key: string; value: string; updated_at: number }>();

  return {
    async init() {},
    async close() {},
    async query(sql: string, params?: unknown[]) {
      if (sql.includes("SELECT * FROM settings WHERE key = ?")) {
        const key = params?.[0] as string;
        const row = store.get(key);
        return { rows: row ? [row] : [] };
      }
      if (sql.includes("SELECT * FROM settings")) {
        return { rows: Array.from(store.values()) };
      }
      return { rows: [] };
    },
    async exec(sql: string, params?: unknown[]) {
      if (sql.includes("INSERT INTO settings")) {
        const [key, value, updated_at] = params as [string, string, number];
        store.set(key, { key, value, updated_at });
        return { rowsAffected: 1 };
      }
      if (sql.includes("DELETE FROM settings WHERE key = ?")) {
        const key = params?.[0] as string;
        const had = store.has(key);
        store.delete(key);
        return { rowsAffected: had ? 1 : 0 };
      }
      if (sql.includes("DELETE FROM settings") && !params?.length) {
        const count = store.size;
        store.clear();
        return { rowsAffected: count };
      }
      return { rowsAffected: 0 };
    },
    async transaction(fn: () => Promise<void>) {
      await fn();
    },
  };
}

describe.each([
  { name: "InMemorySettingsRepository", factory: () => new InMemorySettingsRepository() },
  { name: "SQLiteSettingsRepository", factory: () => new SQLiteSettingsRepository(createMockDatabase()) },
])("$name", ({ factory }) => {
  let repo: ISettingsRepository;

  beforeEach(() => {
    repo = factory();
  });

  describe("get", () => {
    it("should return null for non-existent key", async () => {
      const result = await repo.get("nonexistent");
      expect(result).toBeNull();
    });

    it("should return stored value for existing key", async () => {
      await repo.set("theme", "dark");
      const result = await repo.get<string>("theme");
      expect(result).toBe("dark");
    });

    it("should handle complex objects", async () => {
      const complexValue = { nested: { value: 42 }, array: [1, 2, 3] };
      await repo.set("complex", complexValue);
      const result = await repo.get<typeof complexValue>("complex");
      expect(result).toEqual(complexValue);
    });
  });

  describe("set", () => {
    it("should store a value", async () => {
      await repo.set("key1", "value1");
      const result = await repo.get("key1");
      expect(result).toBe("value1");
    });

    it("should update existing value", async () => {
      await repo.set("key1", "value1");
      await repo.set("key1", "value2");
      const result = await repo.get("key1");
      expect(result).toBe("value2");
    });

    it("should handle different data types", async () => {
      await repo.set("string", "test");
      await repo.set("number", 42);
      await repo.set("boolean", true);
      await repo.set("object", { foo: "bar" });
      await repo.set("array", [1, 2, 3]);

      expect(await repo.get("string")).toBe("test");
      expect(await repo.get("number")).toBe(42);
      expect(await repo.get("boolean")).toBe(true);
      expect(await repo.get("object")).toEqual({ foo: "bar" });
      expect(await repo.get("array")).toEqual([1, 2, 3]);
    });
  });

  describe("delete", () => {
    it("should return false for non-existent key", async () => {
      const result = await repo.delete("nonexistent");
      expect(result).toBe(false);
    });

    it("should delete existing key and return true", async () => {
      await repo.set("key1", "value1");
      const result = await repo.delete("key1");
      expect(result).toBe(true);
      expect(await repo.get("key1")).toBeNull();
    });

    it("should not affect other keys", async () => {
      await repo.set("key1", "value1");
      await repo.set("key2", "value2");
      await repo.delete("key1");
      expect(await repo.get("key2")).toBe("value2");
    });
  });

  describe("getAll", () => {
    it("should return empty object when no settings exist", async () => {
      const result = await repo.getAll();
      expect(result).toEqual({});
    });

    it("should return all settings", async () => {
      await repo.set("key1", "value1");
      await repo.set("key2", 42);
      await repo.set("key3", true);

      const result = await repo.getAll();
      expect(result).toEqual({
        key1: "value1",
        key2: 42,
        key3: true,
      });
    });
  });

  describe("clear", () => {
    it("should remove all settings", async () => {
      await repo.set("key1", "value1");
      await repo.set("key2", "value2");
      await repo.set("key3", "value3");

      await repo.clear();

      const result = await repo.getAll();
      expect(result).toEqual({});
    });

    it("should work on empty repository", async () => {
      await repo.clear();
      const result = await repo.getAll();
      expect(result).toEqual({});
    });
  });
});
