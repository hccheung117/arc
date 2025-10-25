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

// Export factory functions
export {
  createPlatform,
  createBrowserPlatform,
  createElectronPlatform,
  createCapacitorPlatform,
  type PlatformType,
  type PlatformOptions,
} from "./factory.js";

// Export platform-specific options
export type { BrowserPlatformOptions } from "./browser/browser-platform.js";
export type { ElectronPlatformOptions } from "./electron/electron-platform.js";
export type { CapacitorPlatformOptions } from "./capacitor/capacitor-platform.js";

// Export contracts and types
export type {
  Platform,
  IPlatformDatabase,
  DatabaseQueryResult,
  DatabaseExecResult,
  IPlatformHTTP,
  HTTPRequest,
  HTTPResponse,
  IPlatformFileSystem,
  PickedFile,
  AttachmentMetadata,
} from "./contracts/index.js";

// Export errors
export {
  PlatformError,
  NetworkError,
  DatabaseDriverError,
  FileSystemError,
} from "./contracts/errors.js";
