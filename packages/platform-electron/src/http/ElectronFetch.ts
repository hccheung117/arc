/**
 * Electron platform HTTP implementation
 *
 * Re-exports BrowserFetch since Electron's renderer and main processes
 * both have native fetch API support (Electron 38+ uses Node.js 18+).
 */
export { BrowserFetch as ElectronFetch } from "@arc/platform-browser/http/BrowserFetch.js";
