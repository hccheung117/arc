import type { Platform } from "../contracts/platform.js";
import { SqlJsDatabase, SqlJsDatabaseOptions } from "./browser-database.js";
import { BrowserFetch } from "./browser-http.js";
import { BrowserFileSystem } from "./browser-filesystem.js";

/**
 * Configuration options for the browser platform
 */
export interface BrowserPlatformOptions {
  /**
   * Database configuration
   */
  database?: SqlJsDatabaseOptions;

  /**
   * HTTP retry configuration
   */
  http?: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
  };
}

/**
 * Create a browser platform instance
 *
 * This factory function creates a complete browser platform implementation
 * using sql.js for database, native fetch for HTTP, and limited filesystem support.
 *
 * @param options - Configuration options for the browser platform
 * @returns Complete platform implementation for browsers
 *
 * @example
 * ```ts
 * const platform = await createBrowserPlatform({
 *   database: {
 *     wasmPath: '/custom/path/sql-wasm.wasm',
 *     storageKey: 'my-app.db'
 *   }
 * });
 *
 * await platform.database.init();
 * ```
 */
export function createBrowserPlatform(
  options: BrowserPlatformOptions = {}
): Platform {
  return {
    type: "browser",
    database: new SqlJsDatabase(options.database),
    http: new BrowserFetch(options.http),
    filesystem: new BrowserFileSystem(),
  };
}
