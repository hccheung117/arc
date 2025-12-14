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
import { getAttachmentPath } from '@main/foundation/storage'
import { getConfig, setConfig } from '../lib/profile'
import { showThreadContextMenu, showMessageContextMenu, type ThreadMenuAction, type MessageMenuAction } from '../lib/ui'
import { deleteConversation, updateConversation, emitConversationEvent } from '../lib/messages'
import { validated } from '@main/foundation/ipc'

// ============================================================================
// CONFIG
// ============================================================================

const handleConfigGet = validated([z.string()], async (key) => {
  return getConfig(key)
})

const handleConfigSet = validated([z.string(), z.unknown()], async (key, value) => {
  await setConfig(key, value)
})

function registerConfigHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('arc:config:get', handleConfigGet)
  ipcMain.handle('arc:config:set', handleConfigSet)
}

// ============================================================================
// UI - CONTEXT MENUS
// ============================================================================

/**
 * Shows thread context menu and executes the selected action.
 * Returns 'rename' for UI-only action, or null if action was handled.
 */
const handleUIShowThreadContextMenu = validated(
  [z.string(), z.boolean()],
  async (threadId, isPinned): Promise<'rename' | null> => {
    const action = await showThreadContextMenu(isPinned)

    if (action === 'delete') {
      await deleteConversation(threadId)
      emitConversationEvent({ type: 'deleted', id: threadId })
      return null
    }

    if (action === 'togglePin') {
      const conversation = await updateConversation(threadId, { pinned: !isPinned })
      emitConversationEvent({ type: 'updated', conversation })
      return null
    }

    // 'rename' is returned to renderer for UI handling
    return action
  }
)

const handleUIShowMessageContextMenu = validated(
  [z.boolean()],
  async (hasEditOption): Promise<MessageMenuAction | null> => {
    return showMessageContextMenu(hasEditOption)
  }
)

function registerUIHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('arc:ui:showThreadContextMenu', handleUIShowThreadContextMenu)
  ipcMain.handle('arc:ui:showMessageContextMenu', handleUIShowMessageContextMenu)
}

// ============================================================================
// LOGGING
// ============================================================================

function handleLogError(tag: string, message: string, stack?: string): void {
  rendererError(tag, message, stack)
}

function registerLoggingHandlers(ipcMain: IpcMain): void {
  ipcMain.on('arc:log:error', (_event, tag: string, message: string, stack?: string) => {
    handleLogError(tag, message, stack)
  })
}

// ============================================================================
// UTILS
// ============================================================================

const handleUtilsOpenFile = validated([z.string()], async (filePath) => {
  await shell.openPath(filePath)
})

const handleUtilsGetAttachmentPath = validated(
  [z.string(), z.string()],
  async (conversationId, relativePath) => {
    return getAttachmentPath(conversationId, relativePath)
  }
)

function registerUtilsHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('arc:utils:openFile', handleUtilsOpenFile)
  ipcMain.handle('arc:utils:getAttachmentPath', handleUtilsGetAttachmentPath)
}

// ============================================================================
// MAIN REGISTRATION
// ============================================================================

export function registerSystemHandlers(ipcMain: IpcMain): void {
  registerConfigHandlers(ipcMain)
  registerUIHandlers(ipcMain)
  registerLoggingHandlers(ipcMain)
  registerUtilsHandlers(ipcMain)
}
