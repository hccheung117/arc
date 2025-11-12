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

export function registerAllIPC(ipcMain: IpcMain): void {
  for (const [channel, handler] of Object.entries(ipcHandlers)) {
    ipcMain.handle(channel, (_event, ...args) => handler(...(args as any)))
  }
}

type MethodName<T extends IPCChannel> = T extends `${infer _Prefix}:${infer Method}`
  ? `${_Prefix}${Capitalize<Method>}`
  : never

type ElectronAPI = {
  [K in IPCChannel as MethodName<K>]: (...args: IPCArgs<K>) => Promise<IPCReturn<K>>
} & {
  streamAssistantMessage: (conversationId: string, content: string) => MessageStreamHandle
}

export function createElectronAPI(ipcRenderer: IpcRenderer): Omit<ElectronAPI, 'streamAssistantMessage'> {
  return {
    getModels: () => ipcRenderer.invoke('models:get'),
    getMessages: (conversationId: string) => ipcRenderer.invoke('messages:get', conversationId),
    addUserMessage: (conversationId: string, content: string) =>
      ipcRenderer.invoke('messages:addUser', conversationId, content),
    getConversationSummaries: () => ipcRenderer.invoke('conversations:getSummaries'),
  }
}
