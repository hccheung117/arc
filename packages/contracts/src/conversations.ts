export interface ConversationSummary {
  id: string
  title: string
  updatedAt: string
}

export type ContextMenuAction = 'rename' | 'delete' | null

export interface ConversationIPC {
  'conversations:getSummaries': () => Promise<ConversationSummary[]>
  'conversations:delete': (conversationId: string) => Promise<void>
  'conversations:rename': (conversationId: string, title: string) => Promise<void>
  'conversations:showContextMenu': () => Promise<ContextMenuAction>
}
