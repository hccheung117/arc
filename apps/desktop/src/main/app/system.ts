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
import { z } from 'zod'
import { rendererError } from '@main/foundation/logger'
import { getThreadAttachmentPath } from '@main/foundation/paths'
import { getSetting, setSetting } from '@main/lib/profile/operations'
import { validated, register } from '@main/foundation/ipc'
import { SaveDialogOptionsSchema } from '@arc-types/arc-api'

// ============================================================================
// SETTINGS
// ============================================================================

const settingsHandlers = {
  'arc:settings:get': validated([z.string()], async (key) => {
    return getSetting(key)
  }),

  'arc:settings:set': validated([z.string(), z.unknown()], async (key, value) => {
    await setSetting(key, value)
  }),
}

// ============================================================================
// LOGGING (one-way, uses ipcMain.on)
// ============================================================================

function registerLoggingHandlers(ipcMain: IpcMain): void {
  ipcMain.on('arc:log:error', (_event, tag: string, message: string, stack?: string) => {
    rendererError(tag, message, stack)
  })
}

// ============================================================================
// UTILS
// ============================================================================

const utilsHandlers = {
  'arc:utils:openFile': validated([z.string()], async (filePath) => {
    await shell.openPath(filePath)
  }),

  'arc:utils:getThreadAttachmentPath': validated(
    [z.string(), z.string()],
    async (threadId, relativePath) => {
      return getThreadAttachmentPath(threadId, relativePath)
    },
  ),
}

// ============================================================================
// FILES
// ============================================================================

const filesHandlers = {
  'arc:files:showSaveDialog': validated([SaveDialogOptionsSchema], async (options) => {
    const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const result = await dialog.showSaveDialog(window, {
      defaultPath: options.defaultPath,
      filters: options.filters,
    })
    return result.canceled ? null : result.filePath
  }),

  'arc:files:writeFile': validated([z.string(), z.string()], async (filePath, content) => {
    await writeFile(filePath, content, 'utf-8')
  }),
}

// ============================================================================
// REGISTRATION
// ============================================================================

export function registerSystemHandlers(ipcMain: IpcMain): void {
  register(ipcMain, settingsHandlers)
  registerLoggingHandlers(ipcMain)
  register(ipcMain, utilsHandlers)
  register(ipcMain, filesHandlers)
}
