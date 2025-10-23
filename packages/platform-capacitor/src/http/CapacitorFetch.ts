/**
 * Capacitor platform HTTP implementation
 *
 * Re-exports BrowserFetch since modern WebViews (iOS 11+, Android 5+)
 * have native fetch API support with streaming capabilities.
 *
 * For older WebViews without fetch streaming, consider using @capacitor/http
 * plugin for basic requests, but note that it doesn't support SSE streaming.
 */
export { BrowserFetch as CapacitorFetch } from "@arc/platform-browser/http/BrowserFetch.js";
