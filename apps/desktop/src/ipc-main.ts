import type { IpcMain } from 'electron'
import type { IPCRegistry } from './ipc-preload'
import { getModels } from './core/models/handlers'
import { getMessages, addUserMessage, addAssistantMessage } from './core/messages/handlers'
import { getConversationSummaries } from './core/conversations/handlers'
import { updateProviderConfig, getProviderConfig } from './core/providers/handlers'

/**
 * IPC Main Process Module
 *
 * This file runs in Electron's main process (Node.js environment).
 * It imports handlers that use native modules (database, file system, etc.).
 *
 * Responsibilities:
 * - Import handler implementations (which may use native modules)
 * - Register IPC handlers with ipcMain.handle
 * - Bridge renderer requests to main process services
 *
 * See ipc-preload.ts for the renderer/preload side (type-only, no native code).
 */

type IPCChannel = keyof IPCRegistry
type IPCArgs<T extends IPCChannel> = IPCRegistry[T]['args']
type IPCReturn<T extends IPCChannel> = IPCRegistry[T]['return']
type IPCHandler<T extends IPCChannel> = (...args: IPCArgs<T>) => IPCReturn<T> | Promise<IPCReturn<T>>

export const ipcHandlers = {
  'models:get': getModels,
  'messages:get': getMessages,
  'messages:addUser': addUserMessage,
  'messages:addAssistant': addAssistantMessage,
  'conversations:getSummaries': getConversationSummaries,
  'providers:updateConfig': updateProviderConfig,
  'providers:getConfig': getProviderConfig,
} as const satisfies { [K in keyof IPCRegistry]: IPCHandler<K> }

type IPCEntry = {
  [K in IPCChannel]: [K, IPCHandler<K>]
}[IPCChannel]

function registerChannel<T extends IPCChannel>(
  ipcMain: IpcMain,
  channel: T,
  handler: IPCHandler<T>
): void {
  ipcMain.handle(channel, (_event, ...args) => handler(...(args as IPCArgs<T>)))
}

export function registerAllIPC(ipcMain: IpcMain): void {
  const entries = Object.entries(ipcHandlers) as IPCEntry[]
  for (const [channel, handler] of entries) {
    registerChannel(ipcMain, channel, handler)
  }
}
