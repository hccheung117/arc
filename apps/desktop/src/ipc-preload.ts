import type { IpcRenderer } from 'electron'
import type { Model } from '@arc/contracts/src/models'
import type { Message, MessageStreamHandle } from '@arc/contracts/src/messages'
import type { ConversationSummary } from '@arc/contracts/src/conversations'

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
  'messages:addUser': {
    args: [conversationId: string, content: string]
    return: Message
  }
  'messages:addAssistant': {
    args: [conversationId: string, content: string]
    return: Message
  }
  'conversations:getSummaries': {
    args: []
    return: ConversationSummary[]
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

type IPCChannel = keyof IPCRegistry
type IPCArgs<T extends IPCChannel> = IPCRegistry[T]['args']
type IPCReturn<T extends IPCChannel> = IPCRegistry[T]['return']

const electronApiChannels = {
  getModels: 'models:get',
  getMessages: 'messages:get',
  addUserMessage: 'messages:addUser',
  addAssistantMessage: 'messages:addAssistant',
  getConversationSummaries: 'conversations:getSummaries',
  updateProviderConfig: 'providers:updateConfig',
  getProviderConfig: 'providers:getConfig',
} as const

type ElectronApiChannels = typeof electronApiChannels

type ElectronAPI = {
  [K in keyof ElectronApiChannels]: (
    ...args: IPCArgs<ElectronApiChannels[K]>
  ) => Promise<IPCReturn<ElectronApiChannels[K]>>
}

export function createElectronAPI(ipcRenderer: IpcRenderer): ElectronAPI {
  return {
    getModels: () => ipcRenderer.invoke(electronApiChannels.getModels),
    getMessages: (conversationId: string) =>
      ipcRenderer.invoke(electronApiChannels.getMessages, conversationId),
    addUserMessage: (conversationId: string, content: string) =>
      ipcRenderer.invoke(electronApiChannels.addUserMessage, conversationId, content),
    addAssistantMessage: (conversationId: string, content: string) =>
      ipcRenderer.invoke(electronApiChannels.addAssistantMessage, conversationId, content),
    getConversationSummaries: () =>
      ipcRenderer.invoke(electronApiChannels.getConversationSummaries),
    updateProviderConfig: (providerId: string, config: { apiKey?: string; baseUrl?: string }) =>
      ipcRenderer.invoke(electronApiChannels.updateProviderConfig, providerId, config),
    getProviderConfig: (providerId: string) =>
      ipcRenderer.invoke(electronApiChannels.getProviderConfig, providerId),
  }
}
