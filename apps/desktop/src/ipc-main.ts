import type { IpcMain } from 'electron'
import type { IPCRegistry } from './ipc-preload'
import { getModels } from './core/models/handlers'
import { getMessages } from './core/messages/handlers'
import { streamMessage, cancelStream } from './core/messages/stream-handler'
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
type StreamingChannel = 'messages:stream'
type SimpleIPCChannel = Exclude<IPCChannel, StreamingChannel>
type IPCArgs<T extends IPCChannel> = IPCRegistry[T]['args']
type IPCReturn<T extends IPCChannel> = IPCRegistry[T]['return']
type IPCHandler<T extends IPCChannel> = (...args: IPCArgs<T>) => IPCReturn<T> | Promise<IPCReturn<T>>

export const ipcHandlers = {
  'models:get': getModels,
  'messages:get': getMessages,
  'messages:cancelStream': cancelStream,
  'conversations:getSummaries': getConversationSummaries,
  'providers:updateConfig': updateProviderConfig,
  'providers:getConfig': getProviderConfig,
} satisfies Record<SimpleIPCChannel, IPCHandler<SimpleIPCChannel>>

type IPCEntry = {
  [K in SimpleIPCChannel]: [K, IPCHandler<K>]
}[SimpleIPCChannel]

function registerChannel<T extends SimpleIPCChannel>(
  ipcMain: IpcMain,
  channel: T,
  handler: IPCHandler<T>
): void {
  ipcMain.handle(channel, (event, ...args) => {
    return handler(...(args as IPCArgs<T>))
  })
}

function registerMessageStream(ipcMain: IpcMain): void {
  ipcMain.handle('messages:stream', (event, conversationId: string, model: string, content: string) =>
    streamMessage(event.sender, conversationId, model, content),
  )
}

export function registerAllIPC(ipcMain: IpcMain): void {
  const entries = Object.entries(ipcHandlers) as IPCEntry[]
  for (const [channel, handler] of entries) {
    registerChannel(ipcMain, channel, handler)
  }
  registerMessageStream(ipcMain)
}
