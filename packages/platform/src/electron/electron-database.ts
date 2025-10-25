import Database from "better-sqlite3";
import type {
  IPlatformDatabase,
  DatabaseExecResult,
  DatabaseQueryResult,
} from "../contracts/database.js";
import { DatabaseDriverError } from "../contracts/errors.js";

export interface BetterSqlite3DatabaseOptions {
  /**
   * Path to the SQLite database file.
   * If not provided, uses in-memory database.
   */
  filePath?: string;
  /**
   * Whether to enable WAL mode for better concurrent performance.
   * Default: true
   */
  enableWAL?: boolean;
}

/**
 * Electron platform database implementation using better-sqlite3
 *
 * Features:
 * - Native SQLite database with better-sqlite3
 * - WAL mode for improved concurrency
 * - Synchronous API wrapped in async for consistency
 * - Transaction support with nested transaction handling
 */
export class BetterSqlite3Database implements IPlatformDatabase {
  private readonly options: BetterSqlite3DatabaseOptions;
  private db: Database.Database | null = null;
  private initialization: Promise<void> | null = null;
  private transactionDepth = 0;

  constructor(options: BetterSqlite3DatabaseOptions = {}) {
    this.options = options;
  }

  async init(): Promise<void> {
    if (!this.initialization) {
      this.initialization = this.initialize();
    }
    return this.initialization;
  }

  async close(): Promise<void> {
    if (!this.db) {
      return;
    }

    this.db.close();
    this.db = null;
    this.transactionDepth = 0;
    this.initialization = null;
  }

  async query<Row extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params: unknown[] = []
  ): Promise<DatabaseQueryResult<Row>> {
    await this.ensureInitialized();
    const db = this.requireDatabase();

    try {
      const stmt = db.prepare(sql);
      const rows = stmt.all(...params) as Row[];

      return { rows };
    } catch (error) {
      throw new DatabaseDriverError(
        `Query failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        sql,
        error
      );
    }
  }

  async exec(
    sql: string,
    params: unknown[] = []
  ): Promise<DatabaseExecResult> {
    await this.ensureInitialized();
    const db = this.requireDatabase();

    try {
      const stmt = db.prepare(sql);
      const info = stmt.run(...params);

      return { rowsAffected: info.changes };
    } catch (error) {
      throw new DatabaseDriverError(
        `Exec failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        sql,
        error
      );
    }
  }

  async execScript(sql: string): Promise<void> {
    const script = sql.trim();
    if (!script) {
      return;
    }

    await this.transaction(async () => {
      const db = this.requireDatabase();
      try {
        db.exec(script);
      } catch (error) {
        throw new DatabaseDriverError(
          `Script execution failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          sql,
          error
        );
      }
    });
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    await this.ensureInitialized();
    const db = this.requireDatabase();

    // Support nested transactions
    if (this.transactionDepth > 0) {
      this.transactionDepth++;
      try {
        return await fn();
      } finally {
        this.transactionDepth--;
      }
    }

    this.transactionDepth = 1;
    db.prepare("BEGIN IMMEDIATE").run();

    try {
      const result = await fn();
      db.prepare("COMMIT").run();
      return result;
    } catch (error) {
      try {
        db.prepare("ROLLBACK").run();
      } catch (rollbackError) {
        console.error(
          "BetterSqlite3Database: rollback failed",
          rollbackError
        );
      }
      throw error;
    } finally {
      this.transactionDepth = 0;
    }
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private async ensureInitialized(): Promise<void> {
    await this.init();
  }

  private async initialize(): Promise<void> {
    if (this.db) {
      return;
    }

    try {
      // Use in-memory database if no file path provided
      const dbPath = this.options.filePath ?? ":memory:";
      this.db = new Database(dbPath);

      // Enable WAL mode for better concurrent performance
      if (this.options.enableWAL !== false && dbPath !== ":memory:") {
        this.db.pragma("journal_mode = WAL");
      }

      // Enable foreign keys
      this.db.pragma("foreign_keys = ON");
    } catch (error) {
      throw new DatabaseDriverError(
        "Failed to initialize database",
        undefined,
        error
      );
    }
  }

  private requireDatabase(): Database.Database {
    if (!this.db) {
      throw new DatabaseDriverError("BetterSqlite3Database is not initialised");
    }
    return this.db;
  }
}
