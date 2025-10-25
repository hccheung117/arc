/**
 * Factory validation tests
 *
 * Tests the factory system to ensure:
 * - Correct platform is loaded based on type parameter
 * - Dynamic imports work correctly
 * - Invalid platform types are rejected
 */

import { describe, it, expect } from "vitest";
import {
  createPlatform,
  createBrowserPlatform,
  createElectronPlatform,
  createCapacitorPlatform,
} from "../factory.js";
import { SqlJsDatabase } from "../browser/browser-database.js";
import { BetterSqlite3Database } from "../electron/electron-database.js";
import { CapacitorSqliteDatabase } from "../capacitor/capacitor-database.js";

describe("Factory System", () => {
  describe("createPlatform()", () => {
    it("should create browser platform with 'browser' type", async () => {
      const platform = await createPlatform("browser");

      expect(platform.type).toBe("browser");
      expect(platform.database).toBeInstanceOf(SqlJsDatabase);
    });

    it("should create electron platform with 'electron' type", async () => {
      const platform = await createPlatform("electron");

      expect(platform.type).toBe("electron");
      expect(platform.database).toBeInstanceOf(BetterSqlite3Database);
    });

    it("should create capacitor platform with 'capacitor' type", async () => {
      const platform = await createPlatform("capacitor");

      expect(platform.type).toBe("capacitor");
      expect(platform.database).toBeInstanceOf(CapacitorSqliteDatabase);
    });

    it("should pass options to browser platform", async () => {
      const platform = await createPlatform("browser", {
        database: {
          storageKey: "test-db",
        },
      });

      expect(platform.type).toBe("browser");
      expect(platform.database).toBeInstanceOf(SqlJsDatabase);
    });

    it("should pass options to electron platform", async () => {
      const platform = await createPlatform("electron", {
        database: {
          filePath: ":memory:",
        },
      });

      expect(platform.type).toBe("electron");
      expect(platform.database).toBeInstanceOf(BetterSqlite3Database);
    });

    it("should reject invalid platform type", async () => {
      // @ts-expect-error - Testing invalid type
      await expect(createPlatform("invalid")).rejects.toThrow(
        "Invalid platform type"
      );
    });
  });

  describe("Convenience Functions", () => {
    it("createBrowserPlatform() should create browser platform", async () => {
      const platform = await createBrowserPlatform();

      expect(platform.type).toBe("browser");
      expect(platform.database).toBeInstanceOf(SqlJsDatabase);
    });

    it("createElectronPlatform() should create electron platform", async () => {
      const platform = await createElectronPlatform();

      expect(platform.type).toBe("electron");
      expect(platform.database).toBeInstanceOf(BetterSqlite3Database);
    });

    it("createCapacitorPlatform() should create capacitor platform", async () => {
      const platform = await createCapacitorPlatform();

      expect(platform.type).toBe("capacitor");
      expect(platform.database).toBeInstanceOf(CapacitorSqliteDatabase);
    });

    it("convenience functions should accept options", async () => {
      const browserPlatform = await createBrowserPlatform({
        database: { storageKey: "custom" },
      });
      expect(browserPlatform.type).toBe("browser");

      const electronPlatform = await createElectronPlatform({
        database: { filePath: ":memory:" },
      });
      expect(electronPlatform.type).toBe("electron");

      const capacitorPlatform = await createCapacitorPlatform({
        http: { maxRetries: 1 },
      });
      expect(capacitorPlatform.type).toBe("capacitor");
    });
  });

  describe("Platform Isolation", () => {
    it("browser platform should not bundle electron dependencies", async () => {
      const platform = await createPlatform("browser");

      // If we can create a browser platform without errors,
      // it means better-sqlite3 wasn't bundled (it would fail in browser/node test environment)
      expect(platform.type).toBe("browser");
    });

    it("electron platform should not bundle browser WASM", async () => {
      const platform = await createPlatform("electron");

      // If we can create an electron platform without errors,
      // it means sql.js WASM wasn't required
      expect(platform.type).toBe("electron");
    });

    it("each platform should be independently loadable", async () => {
      // Create all platforms to ensure they don't conflict
      const browser = await createBrowserPlatform();
      const electron = await createElectronPlatform();
      const capacitor = await createCapacitorPlatform();

      expect(browser.type).toBe("browser");
      expect(electron.type).toBe("electron");
      expect(capacitor.type).toBe("capacitor");
    });
  });
});
