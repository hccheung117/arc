import type { ArcAPI } from '../../types/arc-api'

/**
 * Returns the arc API exposed via contextBridge.
 * Throws if not running in Electron environment.
 */
export function getArc(): ArcAPI {
  if (typeof window !== 'undefined' && window.arc) {
    return window.arc
  }

  return new Proxy({} as ArcAPI, {
    get(_target, prop) {
      throw new Error(
        `Arc API not available. Ensure the app is running in Electron. (Attempted to access: ${String(prop)})`
      )
    },
  })
}

/**
 * @deprecated Use getArc() instead. Will be removed after M3 migration.
 */
export { getArc as getIPC }
