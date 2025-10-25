/**
 * Browser platform tests
 *
 * Tests the browser platform implementation (sql.js + fetch)
 */

import { describe, it, expect } from "vitest";
import { SqlJsDatabase } from "../browser/browser-database.js";
import { BrowserFetch } from "../browser/browser-http.js";
import { createBrowserPlatform } from "../browser/browser-platform.js";
import { testDatabaseContract, testHTTPContract } from "./contract-compliance.test.js";

describe("Browser Platform", () => {
  it("should create a valid browser platform", () => {
    const platform = createBrowserPlatform();

    expect(platform.type).toBe("browser");
    expect(platform.database).toBeInstanceOf(SqlJsDatabase);
    expect(platform.http).toBeInstanceOf(BrowserFetch);
    expect(platform.filesystem).toBeDefined();
  });

  it("should create browser platform with custom options", () => {
    const platform = createBrowserPlatform({
      database: {
        storageKey: "custom-db",
        persistDebounceMs: 1000,
      },
      http: {
        maxRetries: 5,
      },
    });

    expect(platform.type).toBe("browser");
    expect(platform.database).toBeInstanceOf(SqlJsDatabase);
  });
});

describe("Browser Database (SqlJsDatabase)", () => {
  // Run contract compliance tests
  testDatabaseContract(
    async () =>
      new SqlJsDatabase({
        storageKey: `test-${Date.now()}`,
        // Point to the WASM file in node_modules for testing
        wasmPath: require.resolve("sql.js/dist/sql-wasm.wasm"),
      }),
    [] // No tests skipped - sql.js should pass all tests
  );
});

describe("Browser HTTP (BrowserFetch)", () => {
  // Run contract compliance tests
  testHTTPContract(
    () => new BrowserFetch(),
    ["request", "stream"] // Skip actual HTTP tests (would need mock server)
  );
});
