export interface ConversationSummary {
  id: string
  title: string
  updatedAt: string
  pinned: boolean
}

export type ContextMenuAction = 'rename' | 'delete' | 'togglePin' | null

export interface ConversationIPC {
  'conversations:getSummaries': () => Promise<ConversationSummary[]>
  'conversations:delete': (conversationId: string) => Promise<void>
  'conversations:rename': (conversationId: string, title: string) => Promise<void>
  'conversations:togglePin': (conversationId: string, pinned: boolean) => Promise<void>
  'conversations:showContextMenu': (currentPinnedState: boolean) => Promise<ContextMenuAction>
}
