import type { IpcMain } from 'electron'
import { shell } from 'electron'
import { z } from 'zod'
import type { ContextMenuAction } from '@arc-types/conversations'
import type { MessageContextMenuAction } from '@arc-types/messages'
import { logRendererError } from '../lib/logger'
import { getConfig, setConfig } from '../lib/profile'
import { showThreadContextMenu, showMessageContextMenu } from '../lib/ui'
import { getAttachmentPath } from '../lib/messages'
import { validatedArgs } from '../lib/ipc'

// ============================================================================
// CONFIG
// ============================================================================

async function handleConfigGet<T = unknown>(key: string): Promise<T | null> {
  return getConfig<T>(key)
}

async function handleConfigSet<T = unknown>(key: string, value: T): Promise<void> {
  await setConfig(key, value)
}

function registerConfigHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('arc:config:get', validatedArgs(z.tuple([z.string()]), handleConfigGet))
  ipcMain.handle(
    'arc:config:set',
    validatedArgs(z.tuple([z.string(), z.unknown()]), handleConfigSet)
  )
}

// ============================================================================
// UI
// ============================================================================

async function handleUIShowThreadContextMenu(isPinned: boolean): Promise<ContextMenuAction> {
  return showThreadContextMenu(isPinned)
}

async function handleUIShowMessageContextMenu(
  content: string,
  hasEditOption: boolean
): Promise<MessageContextMenuAction> {
  return showMessageContextMenu(content, hasEditOption)
}

function registerUIHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(
    'arc:ui:showThreadContextMenu',
    validatedArgs(z.tuple([z.boolean()]), handleUIShowThreadContextMenu)
  )
  ipcMain.handle(
    'arc:ui:showMessageContextMenu',
    validatedArgs(z.tuple([z.string(), z.boolean()]), handleUIShowMessageContextMenu)
  )
}

// ============================================================================
// LOGGING
// ============================================================================

function handleLogError(tag: string, message: string, stack?: string): void {
  logRendererError(tag, message, stack)
}

function registerLoggingHandlers(ipcMain: IpcMain): void {
  ipcMain.on('arc:log:error', (_event, tag: string, message: string, stack?: string) => {
    handleLogError(tag, message, stack)
  })
}

// ============================================================================
// UTILS
// ============================================================================

async function handleUtilsOpenFile(filePath: string): Promise<void> {
  await shell.openPath(filePath)
}

async function handleUtilsGetAttachmentPath(
  conversationId: string,
  relativePath: string
): Promise<string> {
  return getAttachmentPath(conversationId, relativePath)
}

function registerUtilsHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('arc:utils:openFile', validatedArgs(z.tuple([z.string()]), handleUtilsOpenFile))
  ipcMain.handle(
    'arc:utils:getAttachmentPath',
    validatedArgs(z.tuple([z.string(), z.string()]), handleUtilsGetAttachmentPath)
  )
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
