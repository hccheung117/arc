/**
 * System IPC Handlers
 *
 * Orchestration layer for config, UI, logging, and utility operations.
 * Composes building blocks from lib/ modules.
 */

import type { IpcMain } from 'electron'
import { shell } from 'electron'
import { z } from 'zod'
import type { ThreadContextMenuResult } from '@arc-types/arc-api'
import { rendererError } from '@main/foundation/logger'
import { getThreadAttachmentPath } from '@main/foundation/paths'
import { getSetting, setSetting } from '@main/lib/profile/operations'
import { showThreadContextMenu, showMessageContextMenu, type MessageMenuAction } from '@main/lib/ui'
import { deleteThread, updateThread, moveToFolder, moveToRoot, createFolderWithThread } from '@main/lib/messages/threads'
import { validated, register, broadcast } from '@main/foundation/ipc'

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

const ThreadContextMenuParamsSchema = z.object({
  threadId: z.string(),
  isPinned: z.boolean(),
  isInFolder: z.boolean(),
  folders: z.array(z.object({ id: z.string(), title: z.string() })),
})

const uiHandlers = {
  /**
   * Shows thread context menu and executes the selected action.
   * Returns 'rename' or 'newFolder:folderId' for UI-only actions, or null if action was handled server-side.
   */
  'arc:ui:showThreadContextMenu': validated(
    [ThreadContextMenuParamsSchema],
    async ({ threadId, isPinned, isInFolder, folders }): Promise<ThreadContextMenuResult> => {
      const action = await showThreadContextMenu({ isPinned, isInFolder, folders })

      if (action === 'delete') {
        await deleteThread(threadId)
        return null
      }

      if (action === 'togglePin') {
        await updateThread(threadId, { pinned: !isPinned })
        return null
      }

      if (action === 'removeFromFolder') {
        const updated = await moveToRoot(threadId)
        if (updated) broadcast('arc:threads:event', { type: 'updated', thread: updated })
        return null
      }

      if (action?.startsWith('moveToFolder:')) {
        const folderId = action.slice('moveToFolder:'.length)
        const updated = await moveToFolder(threadId, folderId)
        if (updated) broadcast('arc:threads:event', { type: 'updated', thread: updated })
        return null
      }

      if (action === 'newFolder') {
        const result = await createFolderWithThread(threadId)
        broadcast('arc:threads:event', { type: 'created', thread: result.folder })
        return `newFolder:${result.folder.id}`
      }

      // At this point, action is either 'rename' or null
      return action === 'rename' ? 'rename' : null
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
