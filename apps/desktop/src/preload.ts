import { contextBridge, ipcRenderer } from 'electron'
import type { Model } from '@arc/contracts/src/models'
import type { Message, MessageStreamHandle } from '@arc/contracts/src/messages'
import type { ConversationSummary } from '@arc/contracts/src/conversations'

contextBridge.exposeInMainWorld('electronAPI', {
  getModels: (): Promise<Model[]> => ipcRenderer.invoke('models:get'),

  getMessages: (conversationId: string): Promise<Message[]> =>
    ipcRenderer.invoke('messages:get', conversationId),

  addUserMessage: (conversationId: string, content: string): Promise<Message> =>
    ipcRenderer.invoke('messages:addUser', conversationId, content),

  streamAssistantMessage: (conversationId: string, content: string): MessageStreamHandle => {
    throw new Error('Streaming not yet implemented via IPC')
  },

  getConversationSummaries: (): Promise<ConversationSummary[]> =>
    ipcRenderer.invoke('conversations:getSummaries'),
})
