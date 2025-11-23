import type { Message } from '../../../types/messages'
import type { ConversationSummary } from '../../../types/conversations'

/**
 * ChatThread: UI ViewModel for organizing messages
 *
 * Decouples UI state from database persistence using dual-identity system:
 * - threadId: Stable UI identifier (never changes)
 * - conversationId: Mutable DB identifier (null → UUID on first message)
 *
 * This enables:
 * - Instant UI feedback (threads exist before database conversations)
 * - Zero blinking (threadId stability prevents re-renders)
 * - Lazy persistence (conversations created only when needed)
 * - Message-first UX (users interact with messages, not conversations)
 */
export type ChatThread = {
  threadId: string
  conversationId: string | null
  messages: Message[]
  status: 'draft' | 'streaming' | 'persisted'
  title: string
  createdAt: string
  isPinned: boolean
}

/**
 * Create a new draft thread for "New Chat"
 *
 * Draft threads have no conversationId yet - it's generated lazily
 * when the user sends their first message.
 */
export function createDraftThread(): ChatThread {
  return {
    threadId: crypto.randomUUID(),
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
    threadId: crypto.randomUUID(),
    conversationId: conv.id,
    messages: [],
    status: 'persisted',
    title: conv.title,
    createdAt: conv.updatedAt,
    isPinned: conv.pinned,
  }
}

/**
 * Generate a title from the first message content
 *
 * Takes the first line of the first user message as the title.
 * Used as a fallback when no explicit title is set.
 */
export function generateTitleFromMessages(messages: Message[]): string {
  if (messages.length === 0) return 'New Chat'

  const firstMessage = messages.find((m) => m.role === 'user')
  if (!firstMessage) return 'New Chat'

  const firstLine = firstMessage.content.split('\n')[0]
  return firstLine.trim() || 'New Chat'
}
