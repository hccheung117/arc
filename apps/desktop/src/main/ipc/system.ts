import type { IpcMain } from 'electron'
import { shell } from 'electron'
import { z } from 'zod'
import { rendererError } from '../lib/logger'
import { getConfig, setConfig } from '../lib/profile'
import { showThreadContextMenu, showMessageContextMenu } from '../lib/ui'
import { getAttachmentPath } from '../lib/messages'
import { validated } from '../lib/ipc'

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
// UI
// ============================================================================

const handleUIShowThreadContextMenu = validated(
  [z.string(), z.boolean()],
  async (threadId, isPinned): Promise<'rename' | null> => {
    return showThreadContextMenu(threadId, isPinned)
  }
)

const handleUIShowMessageContextMenu = validated(
  [z.boolean()],
  async (hasEditOption): Promise<'copy' | 'edit' | null> => {
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
