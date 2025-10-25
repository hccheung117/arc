/**
 * Platform contracts
 *
 * This module defines the core interfaces that all platform implementations
 * must satisfy. These contracts are owned by the platform layer and imported
 * by higher-level packages (@arc/core, @arc/db, @arc/ai).
 */

import type { IPlatformDatabase } from "./database.js";
import type { IPlatformHTTP } from "./http.js";
import type { IPlatformFileSystem } from "./filesystem.js";

export type {
  IPlatformDatabase,
  DatabaseQueryResult,
  DatabaseExecResult,
} from "./database.js";

export type {
  IPlatformHTTP,
  HTTPRequest,
  HTTPResponse,
} from "./http.js";

export type {
  IPlatformFileSystem,
  PickedFile,
  AttachmentMetadata,
} from "./filesystem.js";

export {
  PlatformError,
  NetworkError,
  DatabaseDriverError,
  FileSystemError,
} from "./errors.js";

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
  readonly type: "browser" | "electron" | "capacitor";

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
