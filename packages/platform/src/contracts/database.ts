/**
 * Platform database abstraction
 *
 * Provides a minimal async API for executing SQL against the active platform
 * database implementation (sql.js on web, better-sqlite3 on desktop, etc).
 * Implementations are responsible for managing their own lifecycle and
 * persistence mechanisms while conforming to this interface.
 */

/**
 * Result of a SQL query returning rows.
 */
export interface DatabaseQueryResult<
  Row extends Record<string, unknown> = Record<string, unknown>,
> {
  rows: Row[];
}

/**
 * Result of a SQL mutation statement.
 */
export interface DatabaseExecResult {
  rowsAffected: number;
}

/**
 * Minimal contract each platform-specific database must satisfy.
 */
export interface IPlatformDatabase {
  /**
   * Initialise the underlying database. Safe to call multiple times.
   */
  init(): Promise<void>;

  /**
   * Cleanly dispose of database resources and flush any pending state.
   */
  close(): Promise<void>;

  /**
   * Execute a read-only query and return all rows as plain objects.
   */
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<DatabaseQueryResult<Row>>;

  /**
   * Execute a mutation statement (INSERT/UPDATE/DELETE).
   */
  exec(sql: string, params?: unknown[]): Promise<DatabaseExecResult>;

  /**
   * Execute a multi-statement SQL script atomically.
   */
  execScript(sql: string): Promise<void>;

  /**
   * Run the supplied async function inside a transaction.
   */
  transaction<T>(fn: () => Promise<T>): Promise<T>;
}
