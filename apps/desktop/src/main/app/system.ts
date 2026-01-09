/**
 * System IPC Handlers
 *
 * Orchestration layer for settings, logging, and utility operations.
 * UI handlers (context menus) are in app/ui.ts.
 * Thread/folder handlers are in app/threads.ts.
 */

import type { IpcMain } from 'electron'
import { shell } from 'electron'
import { z } from 'zod'
import { rendererError } from '@main/foundation/logger'
import { getThreadAttachmentPath } from '@main/foundation/paths'
import { getSetting, setSetting } from '@main/lib/profile/operations'
import { validated, register } from '@main/foundation/ipc'

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
// REGISTRATION
// ============================================================================

export function registerSystemHandlers(ipcMain: IpcMain): void {
  register(ipcMain, settingsHandlers)
  registerLoggingHandlers(ipcMain)
  register(ipcMain, utilsHandlers)
}
