import { createId } from '@paralleldrive/cuid2'
import type { Message } from '@arc-types/messages'
import type { ThreadSummary } from '@arc-types/threads'

/**
 * ChatThread: UI ViewModel for organizing messages
 *
 * Uses cuid2 for stable IDs.
 *
 * This enables:
 * - Instant UI feedback (threads exist before database)
 * - Zero blinking (ID stability prevents re-renders)
 * - Lazy persistence (threads created only when needed)
 * - Message-first UX (users interact with messages, not threads)
 */
export type ChatThread = {
  id: string // cuid2 - stable identifier for both UI and database
  messages: Message[]
  status: 'draft' | 'streaming' | 'persisted'
  title: string
  createdAt: string
  updatedAt: string
  isPinned: boolean
}

/**
 * Create a new draft thread for "New Chat"
 *
 * Draft threads use a generated cuid2 ID which will become the
 * database conversationId once persisted.
 */
export function createDraftThread(): ChatThread {
  const now = new Date().toISOString()
  return {
    id: createId(),
    messages: [],
    status: 'draft',
    title: 'New Chat',
    createdAt: now,
    updatedAt: now,
    isPinned: false,
  }
}

/**
 * Hydrate a ChatThread from an existing database thread
 *
 * Used on initial load to convert persisted threads into UI threads.
 * Messages are lazy-loaded when the thread is selected.
 */
export function hydrateFromSummary(summary: ThreadSummary): ChatThread {
  return {
    id: summary.id,
    messages: [],
    status: 'persisted',
    title: summary.title,
    createdAt: summary.createdAt || summary.updatedAt,
    updatedAt: summary.updatedAt,
    isPinned: summary.pinned,
  }
}
