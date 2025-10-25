import type {
  IPlatformDatabase,
  DatabaseExecResult,
  DatabaseQueryResult,
} from "../contracts/database.js";
import { DatabaseDriverError } from "../contracts/errors.js";

/**
 * Capacitor platform database implementation (STUB)
 *
 * TODO: Implement using @capacitor-community/sqlite plugin
 *
 * This is a stub implementation that throws "not implemented" errors.
 * The full implementation will use the Capacitor SQLite plugin to provide
 * native database access on iOS and Android.
 *
 * Planned implementation:
 * - Use @capacitor-community/sqlite for native SQLite access
 * - Support both iOS and Android platforms
 * - Provide same interface as browser and electron implementations
 *
 * @see https://github.com/capacitor-community/sqlite
 */
export class CapacitorSqliteDatabase implements IPlatformDatabase {
  async init(): Promise<void> {
    throw new DatabaseDriverError(
      "Capacitor database not yet implemented. Use @capacitor-community/sqlite plugin."
    );
  }

  async close(): Promise<void> {
    throw new DatabaseDriverError(
      "Capacitor database not yet implemented. Use @capacitor-community/sqlite plugin."
    );
  }

  async query<Row extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<DatabaseQueryResult<Row>> {
    throw new DatabaseDriverError(
      "Capacitor database not yet implemented. Use @capacitor-community/sqlite plugin.",
      sql
    );
  }

  async exec(
    sql: string,
    params?: unknown[]
  ): Promise<DatabaseExecResult> {
    throw new DatabaseDriverError(
      "Capacitor database not yet implemented. Use @capacitor-community/sqlite plugin.",
      sql
    );
  }

  async execScript(sql: string): Promise<void> {
    throw new DatabaseDriverError(
      "Capacitor database not yet implemented. Use @capacitor-community/sqlite plugin.",
      sql
    );
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    throw new DatabaseDriverError(
      "Capacitor database not yet implemented. Use @capacitor-community/sqlite plugin."
    );
  }
}
