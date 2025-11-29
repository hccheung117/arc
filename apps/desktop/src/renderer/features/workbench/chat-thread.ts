import { createId } from '@paralleldrive/cuid2'
import type { Message } from '@arc-types/messages'
import type { ConversationSummary } from '@arc-types/conversations'

/**
 * ChatThread: UI ViewModel for organizing messages
 *
 * Uses cuid2 for stable IDs.
 *
 * This enables:
 * - Instant UI feedback (threads exist before database conversations)
 * - Zero blinking (ID stability prevents re-renders)
 * - Lazy persistence (conversations created only when needed)
 * - Message-first UX (users interact with messages, not conversations)
 */
export type ChatThread = {
  id: string // cuid2 - stable identifier for both UI and database
  messages: Message[]
  status: 'draft' | 'streaming' | 'persisted'
  title: string
  createdAt: string
  isPinned: boolean
}

/**
 * Create a new draft thread for "New Chat"
 *
 * Draft threads use a generated cuid2 ID which will become the
 * database conversationId once persisted.
 */
export function createDraftThread(): ChatThread {
  return {
    id: createId(),
    messages: [],
    status: 'draft',
    title: 'New Chat',
    createdAt: new Date().toISOString(),
    isPinned: false,
  }
}

/**
 * Hydrate a ChatThread from an existing database conversation
 *
 * Used on initial load to convert persisted conversations into UI threads.
 * Messages are lazy-loaded when the thread is selected.
 */
export function hydrateFromConversation(conv: ConversationSummary): ChatThread {
  return {
    id: conv.id,
    messages: [],
    status: 'persisted',
    title: conv.title,
    createdAt: conv.updatedAt,
    isPinned: conv.pinned,
  }
}
