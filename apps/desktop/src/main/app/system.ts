/**
 * System IPC Handlers
 *
 * Orchestration layer for config, UI, logging, and utility operations.
 * Composes building blocks from lib/ modules.
 */

import type { IpcMain } from 'electron'
import { shell } from 'electron'
import { z } from 'zod'
import { rendererError } from '@main/foundation/logger'
import { getThreadAttachmentPath } from '@main/foundation/paths'
import { getSetting, setSetting } from '@main/lib/profile/operations'
import { showThreadContextMenu, showMessageContextMenu, type MessageMenuAction } from '@main/lib/ui'
import { deleteThread, updateThread } from '@main/lib/messages/threads'
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
// UI - CONTEXT MENUS
// ============================================================================

const uiHandlers = {
  /**
   * Shows thread context menu and executes the selected action.
   * Returns 'rename' for UI-only action, or null if action was handled.
   */
  'arc:ui:showThreadContextMenu': validated(
    [z.string(), z.boolean()],
    async (threadId, isPinned): Promise<'rename' | null> => {
      const action = await showThreadContextMenu(isPinned)

      if (action === 'delete') {
        await deleteThread(threadId)
        return null
      }

      if (action === 'togglePin') {
        await updateThread(threadId, { pinned: !isPinned })
        return null
      }

      return action
    },
  ),

  'arc:ui:showMessageContextMenu': validated(
    [z.boolean()],
    async (hasEditOption): Promise<MessageMenuAction | null> => {
      return showMessageContextMenu(hasEditOption)
    },
  ),
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
  register(ipcMain, uiHandlers)
  registerLoggingHandlers(ipcMain)
  register(ipcMain, utilsHandlers)
}
