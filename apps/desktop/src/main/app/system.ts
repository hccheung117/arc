/**
 * System IPC Handlers
 *
 * Orchestration layer for settings, logging, and utility operations.
 * UI handlers (context menus) are in app/ui.ts.
 * Thread/folder handlers are in app/threads.ts.
 */

import type { IpcMain } from 'electron'
import { shell } from 'electron'
import { rendererError } from '@main/foundation/logger'
import { registerHandlers } from '@main/kernel/ipc'
import { utilsContract } from '@contracts/utils'

// ============================================================================
// LOGGING (one-way, uses ipcMain.on - not part of contracts)
// ============================================================================

function registerLoggingHandlers(ipcMain: IpcMain): void {
  ipcMain.on('arc:log:error', (_event, tag: string, message: string, stack?: string) => {
    rendererError(tag, message, stack)
  })
}

// ============================================================================
// REGISTRATION
// ============================================================================

export function registerSystemHandlers(ipcMain: IpcMain): void {
  // Utils
  registerHandlers(ipcMain, utilsContract, {
    openFile: async ({ filePath }) => {
      await shell.openPath(filePath)
    },
  })

  // Logging (one-way, not contract-based)
  registerLoggingHandlers(ipcMain)
}
