import type { IpcRenderer } from 'electron'
import type { Model } from '@arc/contracts/src/models'
import type { Message } from '@arc/contracts/src/messages'
import type { ConversationSummary, ContextMenuAction } from '@arc/contracts/src/conversations'

/**
 * IPC Preload Module
 *
 * This file is imported by preload.ts, which runs in Electron's renderer context.
 * It MUST NOT import any handlers, database code, or native modules.
 *
 * Constraint: Electron's renderer process (Chromium sandbox) cannot load native
 * modules like better-sqlite3. Even with contextIsolation enabled, preload scripts
 * are bundled by webpack for the renderer environment and must remain browser-safe.
 *
 * Responsibilities:
 * - Define IPC type contracts (shared between main and preload)
 * - Provide createElectronAPI factory for preload.ts to expose typed IPC methods
 * - Zero imports of implementation code (handlers, database, native modules)
 *
 * See ipc-main.ts for the main process side (handler registration with native code).
 */

export interface IPCRegistry {
  'models:get': {
    args: []
    return: Model[]
  }
  'messages:get': {
    args: [conversationId: string]
    return: Message[]
  }
  'messages:stream': {
    args: [conversationId: string, model: string, content: string]
    return: { streamId: string; messageId: string }
  }
  'messages:cancelStream': {
    args: [streamId: string]
    return: void
  }
  'conversations:getSummaries': {
    args: []
    return: ConversationSummary[]
  }
  'conversations:delete': {
    args: [conversationId: string]
    return: void
  }
  'conversations:rename': {
    args: [conversationId: string, title: string]
    return: void
  }
  'conversations:showContextMenu': {
    args: []
    return: ContextMenuAction
  }
  'providers:updateConfig': {
    args: [providerId: string, config: { apiKey?: string; baseUrl?: string }]
    return: void
  }
  'providers:getConfig': {
    args: [providerId: string]
    return: { apiKey: string | null; baseUrl: string | null }
  }
}

/**
 * IPC Event Types for Streaming
 * These events are emitted from main process to renderer
 */
export interface StreamDeltaEvent {
  streamId: string
  chunk: string
}

export interface StreamCompleteEvent {
  streamId: string
  message: Message
}

export interface StreamErrorEvent {
  streamId: string
  error: string
}

type IPCChannel = keyof IPCRegistry
type IPCArgs<T extends IPCChannel> = IPCRegistry[T]['args']
type IPCReturn<T extends IPCChannel> = IPCRegistry[T]['return']

const electronApiChannels = {
  getModels: 'models:get',
  getMessages: 'messages:get',
  streamMessage: 'messages:stream',
  cancelStream: 'messages:cancelStream',
  getConversationSummaries: 'conversations:getSummaries',
  deleteConversation: 'conversations:delete',
  renameConversation: 'conversations:rename',
  showThreadContextMenu: 'conversations:showContextMenu',
  updateProviderConfig: 'providers:updateConfig',
  getProviderConfig: 'providers:getConfig',
} as const

type ElectronApiChannels = typeof electronApiChannels

type ElectronAPI = {
  [K in keyof ElectronApiChannels]: (
    ...args: IPCArgs<ElectronApiChannels[K]>
  ) => Promise<IPCReturn<ElectronApiChannels[K]>>
} & {
  // Event listeners for streaming
  onStreamDelta: (callback: (event: StreamDeltaEvent) => void) => () => void
  onStreamComplete: (callback: (event: StreamCompleteEvent) => void) => () => void
  onStreamError: (callback: (event: StreamErrorEvent) => void) => () => void
}

export function createElectronAPI(ipcRenderer: IpcRenderer): ElectronAPI {
  return {
    getModels: () => ipcRenderer.invoke(electronApiChannels.getModels),
    getMessages: (conversationId: string) =>
      ipcRenderer.invoke(electronApiChannels.getMessages, conversationId),
    streamMessage: (conversationId: string, model: string, content: string) =>
      ipcRenderer.invoke(electronApiChannels.streamMessage, conversationId, model, content),
    cancelStream: (streamId: string) =>
      ipcRenderer.invoke(electronApiChannels.cancelStream, streamId),
    getConversationSummaries: () =>
      ipcRenderer.invoke(electronApiChannels.getConversationSummaries),
    deleteConversation: (conversationId: string) =>
      ipcRenderer.invoke(electronApiChannels.deleteConversation, conversationId),
    renameConversation: (conversationId: string, title: string) =>
      ipcRenderer.invoke(electronApiChannels.renameConversation, conversationId, title),
    showThreadContextMenu: () => ipcRenderer.invoke(electronApiChannels.showThreadContextMenu),
    updateProviderConfig: (providerId: string, config: { apiKey?: string; baseUrl?: string }) =>
      ipcRenderer.invoke(electronApiChannels.updateProviderConfig, providerId, config),
    getProviderConfig: (providerId: string) =>
      ipcRenderer.invoke(electronApiChannels.getProviderConfig, providerId),
    onStreamDelta: (callback: (event: StreamDeltaEvent) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: StreamDeltaEvent) => callback(data)
      ipcRenderer.on('message-stream:delta', listener)
      return () => ipcRenderer.removeListener('message-stream:delta', listener)
    },
    onStreamComplete: (callback: (event: StreamCompleteEvent) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: StreamCompleteEvent) => callback(data)
      ipcRenderer.on('message-stream:complete', listener)
      return () => ipcRenderer.removeListener('message-stream:complete', listener)
    },
    onStreamError: (callback: (event: StreamErrorEvent) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: StreamErrorEvent) => callback(data)
      ipcRenderer.on('message-stream:error', listener)
      return () => ipcRenderer.removeListener('message-stream:error', listener)
    },
  }
}
