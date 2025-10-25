import type { Platform } from "./contracts/index.js";
import type { BrowserPlatformOptions } from "./browser/browser-platform.js";
import type { ElectronPlatformOptions } from "./electron/electron-platform.js";
import type { CapacitorPlatformOptions } from "./capacitor/capacitor-platform.js";

/**
 * Platform type identifier
 */
export type PlatformType = "browser" | "electron" | "capacitor";

/**
 * Platform-specific configuration options
 */
export type PlatformOptions =
  | { type: "browser"; options?: BrowserPlatformOptions }
  | { type: "electron"; options?: ElectronPlatformOptions }
  | { type: "capacitor"; options?: CapacitorPlatformOptions };

/**
 * Create a platform instance using dynamic imports
 *
 * This is the main factory function that dynamically loads the correct
 * platform implementation based on the type parameter. Using dynamic imports
 * ensures that only the required platform code is bundled, which is critical
 * for Next.js compatibility and minimizing bundle size.
 *
 * @param type - Platform type identifier
 * @param options - Platform-specific configuration options
 * @returns Complete platform implementation
 * @throws Error if platform type is invalid
 *
 * @example
 * ```ts
 * // Browser platform
 * const browserPlatform = await createPlatform('browser', {
 *   database: { wasmPath: '/custom/sql-wasm.wasm' }
 * });
 *
 * // Electron platform
 * const electronPlatform = await createPlatform('electron', {
 *   database: { filePath: '/path/to/app.db' }
 * });
 * ```
 */
export async function createPlatform(
  type: "browser",
  options?: BrowserPlatformOptions
): Promise<Platform>;
export async function createPlatform(
  type: "electron",
  options?: ElectronPlatformOptions
): Promise<Platform>;
export async function createPlatform(
  type: "capacitor",
  options?: CapacitorPlatformOptions
): Promise<Platform>;
export async function createPlatform(
  type: PlatformType,
  options?: BrowserPlatformOptions | ElectronPlatformOptions | CapacitorPlatformOptions
): Promise<Platform> {
  switch (type) {
    case "browser": {
      const { createBrowserPlatform } = await import(
        "./browser/browser-platform.js"
      );
      return createBrowserPlatform(options as BrowserPlatformOptions);
    }
    case "electron": {
      const { createElectronPlatform } = await import(
        "./electron/electron-platform.js"
      );
      return createElectronPlatform(options as ElectronPlatformOptions);
    }
    case "capacitor": {
      const { createCapacitorPlatform } = await import(
        "./capacitor/capacitor-platform.js"
      );
      return createCapacitorPlatform(options as CapacitorPlatformOptions);
    }
    default: {
      const exhaustiveCheck: never = type;
      throw new Error(`Invalid platform type: ${exhaustiveCheck}`);
    }
  }
}

/**
 * Convenience function to create a browser platform
 *
 * This is a direct import that doesn't use dynamic loading.
 * Use this when you know at build time that you only need the browser platform.
 *
 * @param options - Browser platform configuration
 * @returns Browser platform implementation
 */
export async function createBrowserPlatform(
  options?: BrowserPlatformOptions
): Promise<Platform> {
  const { createBrowserPlatform } = await import(
    "./browser/browser-platform.js"
  );
  return createBrowserPlatform(options);
}

/**
 * Convenience function to create an Electron platform
 *
 * This is a direct import that doesn't use dynamic loading.
 * Use this when you know at build time that you only need the Electron platform.
 *
 * @param options - Electron platform configuration
 * @returns Electron platform implementation
 */
export async function createElectronPlatform(
  options?: ElectronPlatformOptions
): Promise<Platform> {
  const { createElectronPlatform } = await import(
    "./electron/electron-platform.js"
  );
  return createElectronPlatform(options);
}

/**
 * Convenience function to create a Capacitor platform
 *
 * This is a direct import that doesn't use dynamic loading.
 * Use this when you know at build time that you only need the Capacitor platform.
 *
 * Note: Capacitor platform is currently a stub. Database and filesystem
 * operations will throw "not implemented" errors.
 *
 * @param options - Capacitor platform configuration
 * @returns Capacitor platform implementation (stub)
 */
export async function createCapacitorPlatform(
  options?: CapacitorPlatformOptions
): Promise<Platform> {
  const { createCapacitorPlatform } = await import(
    "./capacitor/capacitor-platform.js"
  );
  return createCapacitorPlatform(options);
}
