/**
 * Electron platform tests
 *
 * Tests the Electron platform implementation (better-sqlite3 + IPC filesystem)
 */

import { describe, it, expect } from "vitest";
import { BetterSqlite3Database } from "../electron/electron-database.js";
import { createElectronPlatform } from "../electron/electron-platform.js";
import { testDatabaseContract, testHTTPContract } from "./contract-compliance.test.js";
import { BrowserFetch } from "../browser/browser-http.js";

describe("Electron Platform", () => {
  it("should create a valid electron platform", () => {
    const platform = createElectronPlatform();

    expect(platform.type).toBe("electron");
    expect(platform.database).toBeInstanceOf(BetterSqlite3Database);
    expect(platform.http).toBeInstanceOf(BrowserFetch);
    expect(platform.filesystem).toBeDefined();
  });

  it("should create electron platform with custom options", () => {
    const platform = createElectronPlatform({
      database: {
        filePath: ":memory:",
        enableWAL: false,
      },
      http: {
        maxRetries: 2,
      },
    });

    expect(platform.type).toBe("electron");
    expect(platform.database).toBeInstanceOf(BetterSqlite3Database);
  });
});

describe("Electron Database (BetterSqlite3Database)", () => {
  // Run contract compliance tests with in-memory database
  testDatabaseContract(
    async () =>
      new BetterSqlite3Database({
        filePath: ":memory:",
        enableWAL: false,
      }),
    [] // No tests skipped - better-sqlite3 should pass all tests
  );
});

describe("Electron HTTP (BrowserFetch - shared)", () => {
  // Run contract compliance tests
  testHTTPContract(
    () => new BrowserFetch(),
    ["request", "stream"] // Skip actual HTTP tests (would need mock server)
  );
});
