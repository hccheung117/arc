import type { Model } from '../../../types/models'
import type { Message } from '../../../types/messages'
import type { ConversationSummary, ContextMenuAction } from '../../../types/conversations'

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

export interface ElectronIPC {
  getModels: () => Promise<Model[]>
  getMessages: (conversationId: string) => Promise<Message[]>
  streamMessage: (
    conversationId: string,
    model: string,
    content: string,
  ) => Promise<{ streamId: string; messageId: string }>
  cancelStream: (streamId: string) => Promise<void>
  getConversationSummaries: () => Promise<ConversationSummary[]>
  deleteConversation: (conversationId: string) => Promise<void>
  renameConversation: (conversationId: string, title: string) => Promise<void>
  togglePin: (conversationId: string, pinned: boolean) => Promise<void>
  showThreadContextMenu: (currentPinnedState: boolean) => Promise<ContextMenuAction>
  updateProviderConfig: (
    providerId: string,
    config: { apiKey?: string; baseUrl?: string },
  ) => Promise<void>
  getProviderConfig: (providerId: string) => Promise<{
    apiKey: string | null
    baseUrl: string | null
  }>
  onStreamDelta: (callback: (event: StreamDeltaEvent) => void) => () => void
  onStreamComplete: (callback: (event: StreamCompleteEvent) => void) => () => void
  onStreamError: (callback: (event: StreamErrorEvent) => void) => () => void
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
