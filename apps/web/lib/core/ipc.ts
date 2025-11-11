import type { Model } from '@arc/contracts/src/models'
import type { Message, MessageStreamHandle } from '@arc/contracts/src/messages'
import type { ConversationSummary } from '@arc/contracts/src/conversations'

export interface ElectronIPC {
  getModels: () => Promise<Model[]>
  getMessages: (conversationId: string) => Promise<Message[]>
  addUserMessage: (conversationId: string, content: string) => Promise<Message>
  streamAssistantMessage: (conversationId: string, content: string) => MessageStreamHandle
  getConversationSummaries: () => Promise<ConversationSummary[]>
}

export function getIPC(): ElectronIPC {
  if (typeof window !== 'undefined') {
    const api = (window as any).electronAPI as ElectronIPC | undefined
    if (api) {
      return api
    }
  }

  return new Proxy({} as ElectronIPC, {
    get(_target, prop) {
      throw new Error(
        `Electron IPC not available. Ensure the app is running in Electron. (Attempted to access: ${String(prop)})`
      )
    },
  })
}
