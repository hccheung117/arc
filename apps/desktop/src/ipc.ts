import type { IpcMain, IpcRenderer } from 'electron'
import type { Model } from '@arc/contracts/src/models'
import type { Message, MessageStreamHandle } from '@arc/contracts/src/messages'
import type { ConversationSummary } from '@arc/contracts/src/conversations'
import { getModels } from './core/models/handlers'
import { getMessages, addUserMessage } from './core/messages/handlers'
import { getConversationSummaries } from './core/conversations/handlers'

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
  'conversations:getSummaries': {
    args: []
    return: ConversationSummary[]
  }
}

type IPCChannel = keyof IPCRegistry
type IPCArgs<T extends IPCChannel> = IPCRegistry[T]['args']
type IPCReturn<T extends IPCChannel> = IPCRegistry[T]['return']
type IPCHandler<T extends IPCChannel> = (...args: IPCArgs<T>) => IPCReturn<T> | Promise<IPCReturn<T>>

export const ipcHandlers = {
  'models:get': getModels,
  'messages:get': getMessages,
  'messages:addUser': addUserMessage,
  'conversations:getSummaries': getConversationSummaries,
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

const electronApiChannels = {
  getModels: 'models:get',
  getMessages: 'messages:get',
  addUserMessage: 'messages:addUser',
  getConversationSummaries: 'conversations:getSummaries',
} as const

type ElectronApiChannels = typeof electronApiChannels

type ElectronAPI = {
  [K in keyof ElectronApiChannels]: (
    ...args: IPCArgs<ElectronApiChannels[K]>
  ) => Promise<IPCReturn<ElectronApiChannels[K]>>
} & {
  streamAssistantMessage: (conversationId: string, content: string) => MessageStreamHandle
}

export function createElectronAPI(ipcRenderer: IpcRenderer): Omit<ElectronAPI, 'streamAssistantMessage'> {
  return {
    getModels: () => ipcRenderer.invoke(electronApiChannels.getModels),
    getMessages: (conversationId: string) =>
      ipcRenderer.invoke(electronApiChannels.getMessages, conversationId),
    addUserMessage: (conversationId: string, content: string) =>
      ipcRenderer.invoke(electronApiChannels.addUserMessage, conversationId, content),
    getConversationSummaries: () =>
      ipcRenderer.invoke(electronApiChannels.getConversationSummaries),
  }
}
