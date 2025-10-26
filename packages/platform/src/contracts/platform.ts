/**
 * Core platform interface
 *
 * This is the main contract that platform factories return.
 * It combines all I/O capabilities (database, HTTP, filesystem).
 */

import type { IPlatformDatabase } from "./database.js";
import type { IPlatformHTTP } from "./http.js";
import type { IPlatformFileSystem } from "./filesystem.js";

/**
 * Complete platform interface
 *
 * This is the main contract that platform factories return.
 * It combines all I/O capabilities (database, HTTP, filesystem).
 */
export interface Platform {
  /**
   * Platform identifier
   */
  readonly type: "browser" | "electron" | "capacitor" | "test";

  /**
   * Database I/O operations
   */
  readonly database: IPlatformDatabase;

  /**
   * HTTP I/O operations
   */
  readonly http: IPlatformHTTP;

  /**
   * File system I/O operations (may be limited or unavailable on web)
   */
  readonly filesystem: IPlatformFileSystem;
}
