/**
 * Database wrapper tests for @arc/db
 *
 * Validates that the Database class correctly wraps the platform database,
 * delegates operations, manages transactions, and wraps errors appropriately.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type {
  IPlatformDatabase,
  DatabaseQueryResult,
  DatabaseExecResult,
} from "@arc/platform/contracts/database.js";
import { Database } from "../src/database.js";
import {
  DatabaseConnectionError,
  QueryError,
} from "../src/db-errors.js";

// Helper to create a mock platform database
function createMockDb(): IPlatformDatabase {
  return {
    init: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockResolvedValue({ rows: [] }),
    exec: vi.fn().mockResolvedValue({ rowsAffected: 0 }),
    execScript: vi.fn().mockResolvedValue(undefined),
    transaction: vi.fn().mockImplementation(async (fn) => await fn()),
  };
}

describe("Database Wrapper", () => {
  describe("Initialization", () => {
    it("should initialize the platform database on creation", async () => {
      const mockDb = createMockDb();

      await Database.create(mockDb);

      expect(mockDb.init).toHaveBeenCalledOnce();
    });

    it("should throw DatabaseConnectionError if initialization fails", async () => {
      const mockDb = createMockDb();
      mockDb.init = vi.fn().mockRejectedValue(new Error("Init failed"));

      await expect(Database.create(mockDb)).rejects.toThrow(
        DatabaseConnectionError
      );
    });
  });

  describe("Query Operations", () => {
    let db: Database;
    let mockDb: IPlatformDatabase;

    beforeEach(async () => {
      mockDb = createMockDb();
      db = await Database.create(mockDb);
    });

    it("should delegate query calls to platform database", async () => {
      const expectedResult: DatabaseQueryResult = {
        rows: [{ id: "1", name: "test" }],
      };
      mockDb.query = vi.fn().mockResolvedValue(expectedResult);

      const result = await db.query("SELECT * FROM test", ["param"]);

      expect(mockDb.query).toHaveBeenCalledWith("SELECT * FROM test", ["param"]);
      expect(result).toBe(expectedResult);
    });

    it("should wrap query errors in QueryError", async () => {
      mockDb.query = vi.fn().mockRejectedValue(new Error("Query failed"));

      await expect(db.query("SELECT * FROM test")).rejects.toThrow(QueryError);
    });
  });

  describe("Execute Operations", () => {
    let db: Database;
    let mockDb: IPlatformDatabase;

    beforeEach(async () => {
      mockDb = createMockDb();
      db = await Database.create(mockDb);
    });

    it("should delegate execute calls to platform database", async () => {
      const expectedResult: DatabaseExecResult = { rowsAffected: 1 };
      mockDb.exec = vi.fn().mockResolvedValue(expectedResult);

      const result = await db.execute("INSERT INTO test VALUES (?)", ["value"]);

      expect(mockDb.exec).toHaveBeenCalledWith(
        "INSERT INTO test VALUES (?)",
        ["value"]
      );
      expect(result).toBe(expectedResult);
    });

    it("should wrap execute errors in QueryError", async () => {
      mockDb.exec = vi.fn().mockRejectedValue(new Error("Exec failed"));

      await expect(db.execute("INSERT INTO test VALUES (?)")).rejects.toThrow(
        QueryError
      );
    });
  });

  describe("Script Operations", () => {
    let db: Database;
    let mockDb: IPlatformDatabase;

    beforeEach(async () => {
      mockDb = createMockDb();
      db = await Database.create(mockDb);
    });

    it("should delegate executeScript calls to platform database", async () => {
      const script = "CREATE TABLE test (id TEXT); INSERT INTO test VALUES ('1');";

      await db.executeScript(script);

      expect(mockDb.execScript).toHaveBeenCalledWith(script);
    });

    it("should wrap script errors in QueryError", async () => {
      mockDb.execScript = vi.fn().mockRejectedValue(new Error("Script failed"));

      await expect(db.executeScript("INVALID SQL")).rejects.toThrow(QueryError);
    });
  });

  describe("Transaction Operations", () => {
    let db: Database;
    let mockDb: IPlatformDatabase;

    beforeEach(async () => {
      mockDb = createMockDb();
      db = await Database.create(mockDb);
    });

    it("should delegate transaction calls to platform database", async () => {
      const transactionFn = vi.fn().mockResolvedValue("result");

      const result = await db.transaction(transactionFn);

      expect(mockDb.transaction).toHaveBeenCalledWith(transactionFn);
      expect(result).toBe("result");
    });

    it("should wrap transaction errors in QueryError", async () => {
      mockDb.transaction = vi
        .fn()
        .mockRejectedValue(new Error("Transaction failed"));

      await expect(
        db.transaction(async () => {
          /* no-op */
        })
      ).rejects.toThrow(QueryError);
    });

    it("should propagate transaction function result", async () => {
      mockDb.transaction = vi.fn().mockImplementation(async (fn) => await fn());

      const result = await db.transaction(async () => {
        return { success: true };
      });

      expect(result).toEqual({ success: true });
    });
  });

  describe("Close Operations", () => {
    it("should delegate close calls to platform database", async () => {
      const mockDb = createMockDb();
      const db = await Database.create(mockDb);

      await db.close();

      expect(mockDb.close).toHaveBeenCalledOnce();
    });

    it("should wrap close errors in DatabaseConnectionError", async () => {
      const mockDb = createMockDb();
      mockDb.close = vi.fn().mockRejectedValue(new Error("Close failed"));

      const db = await Database.create(mockDb);

      await expect(db.close()).rejects.toThrow(DatabaseConnectionError);
    });
  });

  describe("Migration Operations", () => {
    it("should run migrations against the platform database", async () => {
      const mockDb = createMockDb();

      // Mock the query for checking applied migrations
      mockDb.query = vi.fn().mockResolvedValue({ rows: [] });

      const db = await Database.create(mockDb);
      const count = await db.migrate();

      // Should have applied at least one migration
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Error Metadata", () => {
    let db: Database;
    let mockDb: IPlatformDatabase;

    beforeEach(async () => {
      mockDb = createMockDb();
      db = await Database.create(mockDb);
    });

    it("should include SQL in QueryError for query failures", async () => {
      mockDb.query = vi.fn().mockRejectedValue(new Error("Query failed"));

      try {
        await db.query("SELECT * FROM test");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(QueryError);
        if (error instanceof QueryError) {
          expect(error.sql).toBe("SELECT * FROM test");
        }
      }
    });

    it("should include SQL in QueryError for execute failures", async () => {
      mockDb.exec = vi.fn().mockRejectedValue(new Error("Exec failed"));

      try {
        await db.execute("INSERT INTO test VALUES (?)");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(QueryError);
        if (error instanceof QueryError) {
          expect(error.sql).toBe("INSERT INTO test VALUES (?)");
        }
      }
    });

    it("should preserve cause in wrapped errors", async () => {
      const originalError = new Error("Original error");
      mockDb.query = vi.fn().mockRejectedValue(originalError);

      try {
        await db.query("SELECT * FROM test");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(QueryError);
        if (error instanceof QueryError) {
          expect(error.cause).toBe(originalError);
        }
      }
    });
  });
});
