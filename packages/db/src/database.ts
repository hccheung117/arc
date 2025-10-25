/**
 * Database wrapper for @arc/db
 *
 * A thin wrapper around the platform-specific database driver that provides
 * a consistent, high-level API for Core to use. This class owns the migration
 * lifecycle and delegates all actual database operations to the platform driver.
 */

import type {
  IPlatformDatabase,
  DatabaseQueryResult,
  DatabaseExecResult,
} from "@arc/platform/contracts/database.js";

import { runMigrations } from "./migrations/runner.js";
import {
  DatabaseConnectionError,
  QueryError,
} from "./db-errors.js";

/**
 * Main database class for Arc.
 *
 * This class is instantiated via a static factory to handle async initialization
 * required by some platform drivers (e.g., sql.js WASM loading).
 */
export class Database {
  private constructor(private readonly platformDb: IPlatformDatabase) {}

  /**
   * Create and initialize a Database instance.
   *
   * @param platformDb - The platform-specific database implementation
   * @returns A fully initialized Database instance
   * @throws DatabaseConnectionError if initialization fails
   */
  static async create(platformDb: IPlatformDatabase): Promise<Database> {
    try {
      await platformDb.init();
      return new Database(platformDb);
    } catch (error) {
      throw new DatabaseConnectionError(
        "Failed to initialize database connection",
        error
      );
    }
  }

  /**
   * Apply all pending migrations to bring the database to the current schema version.
   *
   * @returns The number of migrations applied
   * @throws MigrationError if any migration fails
   */
  async migrate(): Promise<number> {
    // The runner throws MigrationError directly
    return await runMigrations(this.platformDb);
  }

  /**
   * Execute a read-only query and return all matching rows.
   *
   * @param sql - The SQL query string
   * @param params - Optional parameter values for placeholders
   * @returns Query result with rows
   * @throws QueryError if the query fails
   */
  async query<Row extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<DatabaseQueryResult<Row>> {
    try {
      return await this.platformDb.query<Row>(sql, params);
    } catch (error) {
      throw new QueryError("Query execution failed", sql, error);
    }
  }

  /**
   * Execute a mutation statement (INSERT/UPDATE/DELETE).
   *
   * @param sql - The SQL statement
   * @param params - Optional parameter values for placeholders
   * @returns Execution result with affected row count
   * @throws QueryError if the statement fails
   */
  async execute(
    sql: string,
    params?: unknown[]
  ): Promise<DatabaseExecResult> {
    try {
      return await this.platformDb.exec(sql, params);
    } catch (error) {
      throw new QueryError("Statement execution failed", sql, error);
    }
  }

  /**
   * Execute a multi-statement SQL script atomically.
   *
   * @param sql - The SQL script (may contain multiple statements)
   * @throws QueryError if the script fails
   */
  async executeScript(sql: string): Promise<void> {
    try {
      await this.platformDb.execScript(sql);
    } catch (error) {
      throw new QueryError("Script execution failed", sql, error);
    }
  }

  /**
   * Run the supplied async function inside a database transaction.
   * Commits on success, rolls back on error.
   *
   * @param fn - Async function to run within the transaction
   * @returns The result of the transaction function
   * @throws QueryError if the transaction fails
   */
  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await this.platformDb.transaction(fn);
    } catch (error) {
      throw new QueryError("Transaction failed", undefined, error);
    }
  }

  /**
   * Close the database connection and release all resources.
   *
   * @throws DatabaseConnectionError if cleanup fails
   */
  async close(): Promise<void> {
    try {
      await this.platformDb.close();
    } catch (error) {
      throw new DatabaseConnectionError(
        "Failed to close database connection",
        error
      );
    }
  }
}
