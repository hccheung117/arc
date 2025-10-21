import type { Database, SqlJsStatic, SqlValue } from "sql.js";
import type { IPlatformDatabase } from "@arc/core/platform/IPlatformDatabase.js";
import type { DatabaseExecResult, DatabaseQueryResult } from "@arc/core/platform/IPlatformDatabase.js";

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

export class SqlJsDatabase implements IPlatformDatabase {
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
  }

  async exec(
    sql: string,
    params: unknown[] = []
  ): Promise<DatabaseExecResult> {
    await this.ensureInitialized();
    const db = this.requireDatabase();

    db.run(sql, params as SqlValue[]);
    const rowsAffected = db.getRowsModified();

    if (this.transactionDepth === 0) {
      this.schedulePersist();
    }

    return { rowsAffected };
  }

  async execScript(sql: string): Promise<void> {
    const script = sql.trim();
    if (!script) {
      return;
    }

    await this.transaction(async () => {
      const db = this.requireDatabase();
      db.exec(script);
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
      throw new Error(
        "SqlJsDatabase can only be initialised in a browser environment"
      );
    }

    if (!this.sql) {
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
    }

    if (!this.sql) {
      throw new Error("SqlJsDatabase failed to load sql.js");
    }

    const persisted = await this.storage.load(this.storageKey);
    this.db = persisted ? new this.sql.Database(persisted) : new this.sql.Database();
  }

  private requireDatabase(): Database {
    if (!this.db) {
      throw new Error("SqlJsDatabase is not initialised");
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
