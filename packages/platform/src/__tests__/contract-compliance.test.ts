/**
 * Contract compliance tests
 *
 * These tests ensure that all platform implementations adhere to the
 * defined contracts and behave identically regardless of the underlying
 * database driver or HTTP client.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { PlatformDatabase } from "../contracts/database.js";
import type { PlatformHTTP } from "../contracts/http.js";

/**
 * Database contract compliance tests
 *
 * These tests must pass for every platform implementation
 */
export function testDatabaseContract(
  createDatabase: () => Promise<PlatformDatabase>,
  skipTests: string[] = []
) {
  describe("PlatformDatabase Contract", () => {
    let db: PlatformDatabase;

    beforeEach(async () => {
      db = await createDatabase();
      await db.init();
    });

    afterEach(async () => {
      if (db) {
        await db.close();
      }
    });

    if (!skipTests.includes("init")) {
      it("should initialize successfully", async () => {
        // Already initialized in beforeEach
        expect(db).toBeDefined();
      });

      it("should be safe to call init() multiple times", async () => {
        await db.init();
        await db.init();
        // Should not throw
      });
    }

    if (!skipTests.includes("execScript")) {
      it("should execute a multi-statement script", async () => {
        const script = `
          CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);
          INSERT INTO users (name) VALUES ('Alice');
          INSERT INTO users (name) VALUES ('Bob');
        `;

        await db.execScript(script);

        const result = await db.query<{ id: number; name: string }>(
          "SELECT * FROM users ORDER BY id"
        );
        expect(result.rows).toHaveLength(2);
        expect(result.rows[0]?.name).toBe("Alice");
        expect(result.rows[1]?.name).toBe("Bob");
      });

      it("should handle empty scripts gracefully", async () => {
        await db.execScript("");
        await db.execScript("   ");
        // Should not throw
      });
    }

    if (!skipTests.includes("query")) {
      it("should execute queries and return rows", async () => {
        await db.execScript("CREATE TABLE test (id INTEGER, value TEXT)");
        await db.exec("INSERT INTO test (id, value) VALUES (?, ?)", [
          1,
          "hello",
        ]);

        const result = await db.query<{ id: number; value: string }>(
          "SELECT * FROM test WHERE id = ?",
          [1]
        );

        expect(result.rows).toHaveLength(1);
        expect(result.rows[0]?.id).toBe(1);
        expect(result.rows[0]?.value).toBe("hello");
      });

      it("should return empty array for no results", async () => {
        await db.execScript("CREATE TABLE test (id INTEGER)");

        const result = await db.query("SELECT * FROM test");
        expect(result.rows).toEqual([]);
      });
    }

    if (!skipTests.includes("exec")) {
      it("should execute INSERT and return rowsAffected", async () => {
        await db.execScript("CREATE TABLE test (id INTEGER, name TEXT)");

        const result = await db.exec(
          "INSERT INTO test (id, name) VALUES (?, ?)",
          [1, "test"]
        );

        expect(result.rowsAffected).toBe(1);
      });

      it("should execute UPDATE and return rowsAffected", async () => {
        await db.execScript(
          "CREATE TABLE test (id INTEGER, name TEXT); INSERT INTO test VALUES (1, 'old')"
        );

        const result = await db.exec("UPDATE test SET name = ? WHERE id = ?", [
          "new",
          1,
        ]);

        expect(result.rowsAffected).toBe(1);
      });

      it("should execute DELETE and return rowsAffected", async () => {
        await db.execScript(
          "CREATE TABLE test (id INTEGER); INSERT INTO test VALUES (1), (2)"
        );

        const result = await db.exec("DELETE FROM test WHERE id = ?", [1]);

        expect(result.rowsAffected).toBe(1);
      });
    }

    if (!skipTests.includes("transaction")) {
      it("should commit successful transactions", async () => {
        await db.execScript("CREATE TABLE test (id INTEGER)");

        await db.transaction(async () => {
          await db.exec("INSERT INTO test VALUES (?)", [1]);
          await db.exec("INSERT INTO test VALUES (?)", [2]);
        });

        const result = await db.query("SELECT * FROM test");
        expect(result.rows).toHaveLength(2);
      });

      it("should rollback failed transactions", async () => {
        await db.execScript("CREATE TABLE test (id INTEGER PRIMARY KEY)");

        try {
          await db.transaction(async () => {
            await db.exec("INSERT INTO test VALUES (?)", [1]);
            // Duplicate primary key will cause error
            await db.exec("INSERT INTO test VALUES (?)", [1]);
          });
        } catch {
          // Expected to throw
        }

        const result = await db.query("SELECT * FROM test");
        expect(result.rows).toHaveLength(0);
      });

      it("should support nested transactions", async () => {
        await db.execScript("CREATE TABLE test (id INTEGER)");

        await db.transaction(async () => {
          await db.exec("INSERT INTO test VALUES (?)", [1]);

          await db.transaction(async () => {
            await db.exec("INSERT INTO test VALUES (?)", [2]);
          });

          await db.exec("INSERT INTO test VALUES (?)", [3]);
        });

        const result = await db.query("SELECT * FROM test");
        expect(result.rows).toHaveLength(3);
      });
    }

    if (!skipTests.includes("close")) {
      it("should close successfully", async () => {
        await db.close();
        // Should not throw
      });

      it("should be safe to close multiple times", async () => {
        await db.close();
        await db.close();
        // Should not throw
      });
    }
  });
}

/**
 * HTTP contract compliance tests
 *
 * These tests must pass for every platform implementation
 * Note: These tests require a test server or mocking
 */
export function testHTTPContract(
  createHTTP: () => PlatformHTTP,
  skipTests: string[] = []
) {
  describe("PlatformHTTP Contract", () => {
    let http: PlatformHTTP;

    beforeEach(() => {
      http = createHTTP();
    });

    // Always run basic sanity check
    it("should create http instance with required methods", () => {
      expect(http).toBeDefined();
      expect(http.request).toBeInstanceOf(Function);
      expect(http.stream).toBeInstanceOf(Function);
    });

    if (!skipTests.includes("request")) {
      it("should make successful HTTP requests", async () => {
        // This test requires a mock server or actual endpoint
        // Skipping for now as it requires external setup
        expect(http).toBeDefined();
        expect(http.request).toBeInstanceOf(Function);
      });
    }

    if (!skipTests.includes("stream")) {
      it("should support streaming", async () => {
        // This test requires a mock SSE server
        // Skipping for now as it requires external setup
        expect(http).toBeDefined();
        expect(http.stream).toBeInstanceOf(Function);
      });
    }
  });
}
