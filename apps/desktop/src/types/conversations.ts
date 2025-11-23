export interface ConversationSummary {
  id: string
  title: string
  updatedAt: string
  pinned: boolean
}

export type ContextMenuAction = 'rename' | 'delete' | 'togglePin' | null
