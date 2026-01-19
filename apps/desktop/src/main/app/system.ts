/**
 * System IPC Handlers
 *
 * Orchestration layer for settings, logging, and utility operations.
 * UI handlers (context menus) are in app/ui.ts.
 * Thread/folder handlers are in app/threads.ts.
 */

import type { IpcMain } from 'electron'
import { shell, dialog, BrowserWindow } from 'electron'
import { writeFile } from 'node:fs/promises'
import { rendererError } from '@main/foundation/logger'
import { getThreadAttachmentPath } from '@main/kernel/paths.tmp'
import { getSetting, setSetting } from '@main/lib/profile/operations'
import { registerHandlers } from '@main/kernel/ipc'
import { settingsContract } from '@contracts/settings'
import { utilsContract } from '@contracts/utils'
import { filesContract } from '@contracts/files'

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
  // Settings
  registerHandlers(ipcMain, settingsContract, {
    get: async ({ key }) => getSetting(key),
    set: async ({ key, value }) => setSetting(key, value),
  })

  // Utils
  registerHandlers(ipcMain, utilsContract, {
    openFile: async ({ filePath }) => {
      await shell.openPath(filePath)
    },
    getThreadAttachmentPath: async ({ threadId, relativePath }) => {
      return getThreadAttachmentPath(threadId, relativePath)
    },
  })

  // Files
  registerHandlers(ipcMain, filesContract, {
    showSaveDialog: async (options) => {
      const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      const result = await dialog.showSaveDialog(window, {
        defaultPath: options.defaultPath,
        filters: options.filters,
      })
      return result.canceled ? null : result.filePath
    },
    writeFile: async ({ filePath, content }) => {
      await writeFile(filePath, content, 'utf-8')
    },
  })

  // Logging (one-way, not contract-based)
  registerLoggingHandlers(ipcMain)
}
