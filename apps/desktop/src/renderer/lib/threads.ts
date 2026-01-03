import { createId } from '@paralleldrive/cuid2'
import type { Message } from '@arc-types/messages'
import type { ThreadSummary } from '@arc-types/threads'
import type { ThreadEvent, Unsubscribe } from '@arc-types/arc-api'

// ============================================================================
// CHAT THREAD
// ============================================================================

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
  id: string
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

// ============================================================================
// THREAD ACTIONS
// ============================================================================

/**
 * Actions for managing ChatThread state
 *
 * Note: Message-level state (ADD_MESSAGE, UPDATE_MESSAGES, EDIT_AND_TRUNCATE)
 * is now managed by use-message-tree.ts at the view level, not the global thread list.
 */
export type ThreadAction =
  | { type: 'CREATE_DRAFT'; id?: string }
  | { type: 'HYDRATE'; threads: ThreadSummary[] }
  | { type: 'UPDATE_STATUS'; id: string; status: ChatThread['status'] }
  | { type: 'UPDATE_THREAD_METADATA'; id: string; title: string; updatedAt: string }
  | { type: 'DELETE_THREAD'; id: string }
  | { type: 'RENAME_THREAD'; id: string; title: string }

// ============================================================================
// IPC WRAPPERS
// ============================================================================

export async function getThreadSummaries(): Promise<ThreadSummary[]> {
  return window.arc.threads.list()
}

export async function renameThread(threadId: string, title: string): Promise<void> {
  await window.arc.threads.update(threadId, { title })
}

export function onThreadEvent(callback: (event: ThreadEvent) => void): Unsubscribe {
  return window.arc.threads.onEvent(callback)
}

/**
 * Shows thread context menu. Data actions (delete, togglePin) are handled in main.
 * Returns 'rename' for UI-only action, or null otherwise.
 */
export async function showThreadContextMenu(
  threadId: string,
  isPinned: boolean
): Promise<'rename' | null> {
  return window.arc.ui.showThreadContextMenu(threadId, isPinned)
}
