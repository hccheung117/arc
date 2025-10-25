import { describe, it, expect, beforeEach, vi } from "vitest";
import { createCore } from "../src/core.js";
import type { Platform, IPlatformDatabase, IPlatformHTTP } from "@arc/platform";
import { Database } from "@arc/db/database.js";

/**
 * Core Facade Tests
 *
 * Tests the createCore factory function and the Core facade structure.
 */

// Mock the Database module
vi.mock("@arc/db/database.js", () => ({
  Database: {
    create: vi.fn(),
  },
}));

describe("createCore", () => {
  let mockPlatform: Platform;
  let mockDatabase: IPlatformDatabase;
  let mockHTTP: IPlatformHTTP;
  let mockDbInstance: any;

  beforeEach(() => {
    mockDatabase = {
      init: vi.fn(),
      close: vi.fn(),
      query: vi.fn().mockResolvedValue({ rows: [] }),
      exec: vi.fn().mockResolvedValue({ rowsAffected: 0 }),
      transaction: vi.fn(async (fn) => await fn()),
    };

    mockHTTP = {
      request: vi.fn(),
      stream: vi.fn(),
    };

    mockPlatform = {
      database: mockDatabase,
      http: mockHTTP,
    };

    mockDbInstance = {
      migrate: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    };

    vi.mocked(Database.create).mockResolvedValue(mockDbInstance);
  });

  describe("initialization", () => {
    it("should create database instance", async () => {
      await createCore(mockPlatform);

      expect(Database.create).toHaveBeenCalledWith(mockPlatform.database);
    });

    it("should run migrations", async () => {
      await createCore(mockPlatform);

      expect(mockDbInstance.migrate).toHaveBeenCalled();
    });

    it("should create all repositories", async () => {
      const core = await createCore(mockPlatform);

      // Verify the core instance was created successfully
      expect(core).toBeDefined();
      expect(core.providers).toBeDefined();
      expect(core.chats).toBeDefined();
      expect(core.messages).toBeDefined();
      expect(core.search).toBeDefined();
      expect(core.settings).toBeDefined();
    });

    it("should create provider registry", async () => {
      const core = await createCore(mockPlatform);

      // The provider registry is created internally
      // We verify it works by checking the providers API exists
      expect(core.providers).toBeDefined();
    });

    it("should create provider manager", async () => {
      const core = await createCore(mockPlatform);

      // The provider manager is created internally
      // We verify it works by checking the providers API exists
      expect(core.providers).toBeDefined();
    });

    it("should create all API instances", async () => {
      const core = await createCore(mockPlatform);

      expect(core.providers).toBeDefined();
      expect(core.chats).toBeDefined();
      expect(core.messages).toBeDefined();
      expect(core.search).toBeDefined();
      expect(core.settings).toBeDefined();
    });
  });

  describe("facade structure", () => {
    it("should expose core.providers namespace", async () => {
      const core = await createCore(mockPlatform);

      expect(core.providers).toBeDefined();
      expect(typeof core.providers.list).toBe("function");
      expect(typeof core.providers.create).toBe("function");
      expect(typeof core.providers.update).toBe("function");
      expect(typeof core.providers.delete).toBe("function");
      expect(typeof core.providers.checkConnection).toBe("function");
    });

    it("should expose core.chats namespace", async () => {
      const core = await createCore(mockPlatform);

      expect(core.chats).toBeDefined();
      expect(typeof core.chats.create).toBe("function");
      expect(typeof core.chats.get).toBe("function");
      expect(typeof core.chats.list).toBe("function");
      expect(typeof core.chats.rename).toBe("function");
      expect(typeof core.chats.delete).toBe("function");
      expect(typeof core.chats.sendMessage).toBe("function");
    });

    it("should expose core.messages namespace", async () => {
      const core = await createCore(mockPlatform);

      expect(core.messages).toBeDefined();
      expect(typeof core.messages.regenerate).toBe("function");
      expect(typeof core.messages.edit).toBe("function");
      expect(typeof core.messages.delete).toBe("function");
      expect(typeof core.messages.stop).toBe("function");
    });

    it("should expose core.search namespace", async () => {
      const core = await createCore(mockPlatform);

      expect(core.search).toBeDefined();
      expect(typeof core.search.messages).toBe("function");
      expect(typeof core.search.messagesInChat).toBe("function");
      expect(typeof core.search.chats).toBe("function");
    });

    it("should expose core.settings namespace", async () => {
      const core = await createCore(mockPlatform);

      expect(core.settings).toBeDefined();
      expect(typeof core.settings.get).toBe("function");
      expect(typeof core.settings.update).toBe("function");
      expect(typeof core.settings.reset).toBe("function");
    });

    it("should expose core.close method", async () => {
      const core = await createCore(mockPlatform);

      expect(typeof core.close).toBe("function");
    });
  });

  describe("close", () => {
    it("should close platform database", async () => {
      const core = await createCore(mockPlatform);

      await core.close();

      expect(mockPlatform.database.close).toHaveBeenCalled();
    });
  });
});
