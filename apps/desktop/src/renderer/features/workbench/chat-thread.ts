import { createId } from '@paralleldrive/cuid2'
import type { Message } from '@arc-types/messages'
import type { ConversationSummary } from '@arc-types/conversations'

/**
 * ChatThread: UI ViewModel for organizing messages
 *
 * Uses cuid2 for stable IDs. Both threadId and conversationId use cuid2
 * for consistency and better properties (sortable, URL-safe, collision-resistant).
 *
 * This enables:
 * - Instant UI feedback (threads exist before database conversations)
 * - Zero blinking (ID stability prevents re-renders)
 * - Lazy persistence (conversations created only when needed)
 * - Message-first UX (users interact with messages, not conversations)
 */
export type ChatThread = {
  threadId: string // cuid2 - stable UI identifier
  conversationId: string | null // cuid2 - database identifier (null until persisted)
  messages: Message[]
  status: 'draft' | 'streaming' | 'persisted'
  title: string
  createdAt: string
  isPinned: boolean
}

/**
 * Create a new draft thread for "New Chat"
 *
 * Draft threads have no conversationId yet - it's generated using cuid2
 * when the user sends their first message.
 */
export function createDraftThread(): ChatThread {
  return {
    threadId: createId(),
    conversationId: null,
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
    threadId: createId(),
    conversationId: conv.id,
    messages: [],
    status: 'persisted',
    title: conv.title,
    createdAt: conv.updatedAt,
    isPinned: conv.pinned,
  }
}

