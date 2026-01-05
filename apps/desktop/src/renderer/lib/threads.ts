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
 * Uses cuid2 for stable IDs. Supports nested structure for folders.
 *
 * This enables:
 * - Instant UI feedback (threads exist before database)
 * - Zero blinking (ID stability prevents re-renders)
 * - Lazy persistence (threads created only when needed)
 * - Message-first UX (users interact with messages, not threads)
 * - Folder organization (threads with children[] act as folders)
 */
export type ChatThread = {
  id: string
  messages: Message[]
  status: 'draft' | 'streaming' | 'persisted'
  title: string
  createdAt: string
  updatedAt: string
  isPinned: boolean
  children: ChatThread[]
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
    children: [],
  }
}

/**
 * Hydrate a ChatThread from an existing database thread
 *
 * Used on initial load to convert persisted threads into UI threads.
 * Messages are lazy-loaded when the thread is selected.
 * Recursively hydrates children for folder support.
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
    children: summary.children.map(hydrateFromSummary),
  }
}

// ============================================================================
// THREAD ACTIONS
// ============================================================================

/**
 * Actions for managing ChatThread state
 *
 * Four actions with CRUD-like semantics:
 * - HYDRATE: Bulk load from database
 * - UPSERT: Create or replace a thread
 * - PATCH: Partial update (optimistic)
 * - DELETE: Remove a thread
 */
export type ThreadAction =
  | { type: 'HYDRATE'; threads: ThreadSummary[] }
  | { type: 'UPSERT'; thread: ChatThread }
  | { type: 'PATCH'; id: string; patch: Partial<ChatThread> }
  | { type: 'DELETE'; id: string }

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
