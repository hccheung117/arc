/**
 * @arc/platform - Unified Platform Layer
 *
 * This package provides a unified platform abstraction for Arc, consolidating
 * browser, Electron, and Capacitor platform implementations into a single package.
 *
 * Key features:
 * - Contract-first design with platform-owned interfaces
 * - Dynamic imports for optimal tree-shaking and bundle size
 * - Consistent API across all platforms
 * - Complete isolation of platform-specific dependencies
 *
 * @packageDocumentation
 */

// Export factory functions (value exports to ensure JS emission)
import {
  createPlatform,
  createBrowserPlatform,
  createElectronPlatform,
  createCapacitorPlatform,
} from "./factory.js";
export {
  createPlatform,
  createBrowserPlatform,
  createElectronPlatform,
  createCapacitorPlatform,
};
export type { PlatformType, PlatformOptions } from "./factory.js";

// Export platform-specific options
export type { BrowserPlatformOptions } from "./browser/browser-platform.js";
export type { ElectronPlatformOptions } from "./electron/electron-platform.js";
export type { CapacitorPlatformOptions } from "./capacitor/capacitor-platform.js";

// Export contracts and types
export type {
  PlatformDatabase,
  DatabaseQueryResult,
  DatabaseExecResult,
} from "./contracts/database.js";

export type {
  PlatformHTTP,
  HTTPRequest,
  HTTPResponse,
} from "./contracts/http.js";

export type {
  PlatformFileSystem,
  PickedFile,
  AttachmentMetadata,
} from "./contracts/filesystem.js";

export type {
  Platform,
} from "./contracts/platform.js";

// Export errors
export {
  PlatformError,
  NetworkError,
  DatabaseDriverError,
  FileSystemError,
} from "./contracts/errors.js";
