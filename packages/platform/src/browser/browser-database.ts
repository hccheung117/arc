import type { Database, SqlJsStatic, SqlValue } from "sql.js";
import type {
  PlatformDatabase,
  DatabaseExecResult,
  DatabaseQueryResult,
} from "../contracts/database.js";
import { DatabaseDriverError } from "../contracts/errors.js";
import { IndexedDbStorage } from "./idb-storage.js";

export interface SqlJsDatabaseOptions {
  /**
   * Explicit path or URL to sql-wasm.wasm. Defaults to /vendor/sql-wasm.wasm,
   * optionally prefixed by NEXT_PUBLIC_BASE_PATH or provided basePath.
   */
  wasmPath?: string;
  /**
   * Base path used when building the default wasm path.
   */
  basePath?: string;
  /**
   * IndexedDB key to store the exported database bytes.
   */
  storageKey?: string;
  /**
   * Custom database/store names for IndexedDB persistence.
   */
  databaseName?: string;
  storeName?: string;
  /**
   * Debounce duration before flushing writes when not inside a transaction.
   */
  persistDebounceMs?: number;
}

const DEFAULT_STORAGE_KEY = "arc.sqlite";
const DEFAULT_DEBOUNCE_MS = 400;

/**
 * Browser platform database implementation using sql.js (WASM-based SQLite)
 *
 * Features:
 * - In-memory SQLite database powered by sql.js
 * - Automatic persistence to IndexedDB
 * - Debounced writes for performance
 * - Transaction support with automatic persistence
 */
export class SqlJsDatabase implements PlatformDatabase {
  private readonly options: SqlJsDatabaseOptions;
  private readonly storage: IndexedDbStorage;
  private readonly storageKey: string;
  private readonly persistDebounceMs: number;

  private sql: SqlJsStatic | null = null;
  private db: Database | null = null;
  private initialization: Promise<void> | null = null;
  private transactionDepth = 0;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private persistPromise: Promise<void> | null = null;

  constructor(options: SqlJsDatabaseOptions = {}) {
    this.options = options;
    this.storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY;
    this.persistDebounceMs = options.persistDebounceMs ?? DEFAULT_DEBOUNCE_MS;
    this.storage = new IndexedDbStorage(
      options.databaseName,
      options.storeName
    );
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

    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }

    await this.persist();
    this.db.close();
    this.db = null;
    this.transactionDepth = 0;
    this.persistPromise = null;
    this.initialization = null;
    // Keep SqlJsStatic cached for subsequent init calls.
  }

  async query<Row extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params: unknown[] = []
  ): Promise<DatabaseQueryResult<Row>> {
    await this.ensureInitialized();
    const db = this.requireDatabase();

    try {
      const statement = db.prepare(sql);
      try {
        if (params.length > 0) {
          statement.bind(params as SqlValue[]);
        }

        const rows: Row[] = [];
        while (statement.step()) {
          rows.push(statement.getAsObject() as Row);
        }

        return { rows };
      } finally {
        statement.free();
      }
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
      db.run(sql, params as SqlValue[]);
      const rowsAffected = db.getRowsModified();

      if (this.transactionDepth === 0) {
        this.schedulePersist();
      }

      return { rowsAffected };
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

    if (this.transactionDepth > 0) {
      this.transactionDepth++;
      try {
        return await fn();
      } finally {
        this.transactionDepth--;
      }
    }

    this.transactionDepth = 1;
    db.run("BEGIN IMMEDIATE");

    try {
      const result = await fn();
      db.run("COMMIT");
      await this.persist();
      return result;
    } catch (error) {
      try {
        db.run("ROLLBACK");
      } catch (rollbackError) {
        console.error("SqlJsDatabase: rollback failed", rollbackError);
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

    if (typeof window === "undefined") {
      throw new DatabaseDriverError(
        "SqlJsDatabase can only be initialised in a browser environment"
      );
    }

    if (!this.sql) {
      try {
        // Dynamically import sql.js to avoid bundling it in SSR
        const initSqlJs = (await import("sql.js")).default;
        this.sql = await initSqlJs({
          locateFile: (file) => {
            if (file.endsWith(".wasm")) {
              return this.resolveWasmPath();
            }
            return file;
          },
        });
      } catch (error) {
        throw new DatabaseDriverError(
          "Failed to load sql.js",
          undefined,
          error
        );
      }
    }

    if (!this.sql) {
      throw new DatabaseDriverError("SqlJsDatabase failed to load sql.js");
    }

    try {
      const persisted = await this.storage.load(this.storageKey);
      this.db = persisted
        ? new this.sql.Database(persisted)
        : new this.sql.Database();
    } catch (error) {
      throw new DatabaseDriverError(
        "Failed to initialize database from IndexedDB",
        undefined,
        error
      );
    }
  }

  private requireDatabase(): Database {
    if (!this.db) {
      throw new DatabaseDriverError("SqlJsDatabase is not initialised");
    }
    return this.db;
  }

  private resolveWasmPath(): string {
    if (this.options.wasmPath) {
      return this.normalizeAssetPath(this.options.wasmPath);
    }

    const basePath =
      this.options.basePath ??
      (typeof process !== "undefined"
        ? process.env.NEXT_PUBLIC_BASE_PATH
        : undefined) ??
      "";

    if (!basePath) {
      return "/vendor/sql-wasm.wasm";
    }

    const trimmed = basePath.replace(/\/+$/, "");
    const withLeadingSlash = trimmed.startsWith("/")
      ? trimmed
      : `/${trimmed}`;

    return this.normalizeAssetPath(`${withLeadingSlash}/vendor/sql-wasm.wasm`);
  }

  private normalizeAssetPath(path: string): string {
    if (/^https?:\/\//.test(path)) {
      return path;
    }

    const prefix = path.startsWith("/") ? "" : "/";
    return `${prefix}${path}`.replace(/\/{2,}/g, "/");
  }

  private schedulePersist(): void {
    if (this.transactionDepth > 0) {
      return;
    }

    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
    }

    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      void this.persist();
    }, this.persistDebounceMs);
  }

  private async persist(): Promise<void> {
    if (!this.db) {
      return;
    }

    if (this.persistPromise) {
      await this.persistPromise;
      return;
    }

    const data = this.db.export();
    this.persistPromise = this.storage.save(this.storageKey, data);

    try {
      await this.persistPromise;
    } catch (error) {
      console.error("SqlJsDatabase: failed to persist database", error);
    } finally {
      this.persistPromise = null;
    }
  }
}
