import { createId } from '@paralleldrive/cuid2'
import type { Message } from '@arc-types/messages'
import type { ThreadSummary } from '@arc-types/threads'
import type { ThreadEvent, ThreadContextMenuParams, ThreadContextMenuResult, Unsubscribe } from '@arc-types/arc-api'

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
 *
 * Ownership semantics:
 * - 'local': Draft thread, config lives in renderer state only
 * - 'db': Persisted thread, backend is source of truth for config
 */
export type ChatThread = {
  id: string
  messages: Message[]
  status: 'draft' | 'streaming' | 'persisted'
  owner: 'local' | 'db'
  title: string
  createdAt: string
  updatedAt: string
  isPinned: boolean
  systemPrompt: string | null
  children: ChatThread[]
}

/**
 * Create a new draft thread for "New Chat"
 *
 * Draft threads use a generated cuid2 ID which will become the
 * database conversationId once persisted.
 */
export function createDraftThread(systemPrompt?: string | null): ChatThread {
  const now = new Date().toISOString()
  return {
    id: createId(),
    messages: [],
    status: 'draft',
    owner: 'local',
    title: 'New Chat',
    createdAt: now,
    updatedAt: now,
    isPinned: false,
    systemPrompt: systemPrompt ?? null,
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
    owner: 'db',
    title: summary.title,
    createdAt: summary.createdAt || summary.updatedAt,
    updatedAt: summary.updatedAt,
    isPinned: summary.pinned,
    systemPrompt: summary.systemPrompt,
    children: summary.children.map(hydrateFromSummary),
  }
}

// ============================================================================
// THREAD CONFIG
// ============================================================================

/**
 * Thread configuration for handoff during first message creation.
 * Extracted from local ChatThread and bundled with the first message IPC.
 */
export type ThreadConfig = {
  systemPrompt: string | null
}

/**
 * Extract thread config from a ChatThread for handoff.
 * Only used when owner='local' to bundle config with first message.
 */
export function extractThreadConfig(thread: ChatThread): ThreadConfig {
  return {
    systemPrompt: thread.systemPrompt,
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
 * Shows thread context menu and returns the selected action.
 * The caller is responsible for calling the appropriate domain IPC based on the action.
 */
export async function showThreadContextMenu(
  params: ThreadContextMenuParams
): Promise<ThreadContextMenuResult> {
  return window.arc.ui.showThreadContextMenu(params)
}

// ============================================================================
// DOMAIN IPC WRAPPERS
// ============================================================================

export async function deleteThread(threadId: string): Promise<void> {
  await window.arc.threads.delete(threadId)
}

export async function toggleThreadPin(threadId: string, isPinned: boolean): Promise<void> {
  await window.arc.threads.update(threadId, { pinned: !isPinned })
}

export async function removeThreadFromFolder(threadId: string): Promise<void> {
  await window.arc.folders.moveToRoot(threadId)
}

export async function moveThreadToFolder(threadId: string, folderId: string): Promise<void> {
  await window.arc.folders.moveThread(threadId, folderId)
}

export async function createFolderWithThread(threadId: string): Promise<{ id: string }> {
  const folder = await window.arc.folders.createWithThread(threadId)
  return { id: folder.id }
}

export async function duplicateThread(threadId: string, upToMessageId?: string): Promise<void> {
  await window.arc.threads.duplicate(threadId, upToMessageId)
}
