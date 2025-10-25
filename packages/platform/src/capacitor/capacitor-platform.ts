import type { Platform } from "../contracts/index.js";
import { CapacitorSqliteDatabase } from "./capacitor-database.js";
import { BrowserFetch } from "../browser/browser-http.js";
import { CapacitorFileSystem } from "./capacitor-filesystem.js";

/**
 * Configuration options for the capacitor platform
 */
export interface CapacitorPlatformOptions {
  /**
   * HTTP retry configuration
   * Capacitor reuses the browser fetch implementation
   */
  http?: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
  };
}

/**
 * Create a Capacitor platform instance (STUB)
 *
 * This factory function creates a Capacitor platform implementation stub.
 * Database and filesystem operations will throw "not implemented" errors.
 * HTTP operations use the same fetch implementation as browser.
 *
 * TODO: Implement full Capacitor support with:
 * - @capacitor-community/sqlite for database
 * - @capacitor/filesystem for file operations
 * - Native mobile plugins for enhanced functionality
 *
 * @param options - Configuration options for the Capacitor platform
 * @returns Complete platform implementation for Capacitor (stub)
 *
 * @example
 * ```ts
 * const platform = await createCapacitorPlatform();
 * // Note: database and filesystem operations will throw errors
 * // Only HTTP operations are currently functional
 * ```
 */
export function createCapacitorPlatform(
  options: CapacitorPlatformOptions = {}
): Platform {
  return {
    type: "capacitor",
    database: new CapacitorSqliteDatabase(),
    http: new BrowserFetch(options.http),
    filesystem: new CapacitorFileSystem(),
  };
}
