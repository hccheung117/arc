/**
 * Module IPC
 *
 * Auto-registers IPC handlers for modules. Channel names derived from
 * module name + operation keys: arc:{module}:{operation}.
 *
 * No validation - renderer is trusted code. Domain validation in business logic.
 */

import { BrowserWindow } from 'electron'

// ============================================================================
// BROADCAST
// ============================================================================

/**
 * Broadcasts a message to all open windows.
 */
export function broadcast(channel, data) {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(channel, data)
  }
}

// ============================================================================
// MODULE EMITTER
// ============================================================================

/**
 * Creates a scoped emitter for a module that validates event names
 * against the module's `emits` declaration and broadcasts to per-event channels.
 */
export function createModuleEmitter(
  moduleName,
  declaredEvents
) {
  return (event, data) => {
    if (!declaredEvents.includes(event)) {
      throw new Error(
        `Module "${moduleName}" emitted undeclared event "${event}". Declared: [${declaredEvents.join(', ')}]`
      )
    }
    broadcast(channel(moduleName, event), data)
  }
}

// ============================================================================
// CHANNEL NAMES
// ============================================================================

/** Derive IPC channel name: arc:{domain}:{operation} */
const channel = (domain, operation) => `arc:${domain}:${operation}`

// ============================================================================
// MODULE AUTO-REGISTRATION
// ============================================================================

/**
 * Auto-registers IPC handlers for a module.
 * Derives channel names from module name + operation keys.
 * Channel format: arc:{moduleName}:{operationName}
 */
export function registerModuleIPC(
  ipcMain,
  moduleName,
  api
) {
  for (const operationName of Object.keys(api)) {
    const ch = channel(moduleName, operationName)
    const handler = api[operationName]

    ipcMain.handle(ch, async (_event, input) => {
      return handler(input)
    })
  }
}
