import type { Platform } from "../contracts/platform.js";
import {
  BetterSqlite3Database,
  BetterSqlite3DatabaseOptions,
} from "./electron-database.js";
import { BrowserFetch } from "../browser/browser-http.js";
import { ElectronFileSystem } from "./electron-filesystem.js";

/**
 * Configuration options for the electron platform
 */
export interface ElectronPlatformOptions {
  /**
   * Database configuration
   */
  database?: BetterSqlite3DatabaseOptions;

  /**
   * HTTP retry configuration
   * Electron reuses the browser fetch implementation
   */
  http?: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
  };
}

/**
 * Create an Electron platform instance
 *
 * This factory function creates a complete Electron platform implementation
 * using better-sqlite3 for database, native fetch for HTTP (shared with browser),
 * and IPC-based filesystem access.
 *
 * @param options - Configuration options for the Electron platform
 * @returns Complete platform implementation for Electron
 *
 * @example
 * ```ts
 * const platform = await createElectronPlatform({
 *   database: {
 *     filePath: '/path/to/app.db',
 *     enableWAL: true
 *   }
 * });
 *
 * await platform.database.init();
 * ```
 */
export function createElectronPlatform(
  options: ElectronPlatformOptions = {}
): Platform {
  return {
    type: "electron",
    database: new BetterSqlite3Database(options.database),
    http: new BrowserFetch(options.http),
    filesystem: new ElectronFileSystem(),
  };
}
