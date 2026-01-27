import { createId } from '@paralleldrive/cuid2'
import type { Message } from '@renderer/lib/messages'
import type { StoredThread, Prompt } from '@main/modules/threads/json-file'
import type { ThreadContextMenuParams, ThreadMenuAction } from '@main/modules/ui/business'

type ThreadEvent =
  | { type: 'created'; thread: StoredThread }
  | { type: 'updated'; thread: StoredThread }
  | { type: 'deleted'; id: string }

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
  prompt: Prompt
  children: ChatThread[]
}

interface DraftThreadOptions {
  prompt?: Prompt
}

/**
 * Create a new draft thread for "New Chat"
 *
 * Draft threads use a generated cuid2 ID which will become the
 * database conversationId once persisted.
 */
export function createDraftThread(options?: DraftThreadOptions): ChatThread {
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
    prompt: options?.prompt ?? { type: 'none' },
    children: [],
  }
}

/**
 * Hydrate a ChatThread from backend Thread.
 *
 * Handles field transformations:
 * - title: null → 'Untitled'
 * - pinned → isPinned
 */
export function hydrateThread(thread: StoredThread): ChatThread {
  return {
    id: thread.id,
    messages: [],
    status: 'persisted',
    owner: 'db',
    title: thread.title ?? 'Untitled',
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    isPinned: thread.pinned,
    prompt: thread.prompt,
    children: thread.children.map(hydrateThread),
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
  prompt: Prompt
}

/**
 * Extract thread config from a ChatThread for handoff.
 * Only used when owner='local' to bundle config with first message.
 */
export function extractThreadConfig(thread: ChatThread): ThreadConfig {
  return {
    prompt: thread.prompt,
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
  | { type: 'HYDRATE'; threads: ChatThread[] }
  | { type: 'UPSERT'; thread: ChatThread }
  | { type: 'PATCH'; id: string; patch: Partial<ChatThread> }
  | { type: 'DELETE'; id: string }

// ============================================================================
// IPC WRAPPERS
// ============================================================================

export async function getThreads(): Promise<ChatThread[]> {
  const threads = await window.arc.threads.list()
  return threads.map(hydrateThread)
}

export async function renameThread(threadId: string, title: string): Promise<void> {
  await window.arc.threads.update({ threadId, patch: { title } })
}

export function onThreadEvent(callback: (event: ThreadEvent) => void): () => void {
  return window.arc.threads.onEvent(callback)
}

/**
 * Shows thread context menu and returns the selected action.
 * The caller is responsible for calling the appropriate domain IPC based on the action.
 */
export async function showThreadContextMenu(
  params: ThreadContextMenuParams
): Promise<ThreadMenuAction | null> {
  return window.arc.ui.showThreadContextMenu(params)
}

// ============================================================================
// DOMAIN IPC WRAPPERS
// ============================================================================

export async function deleteThread(threadId: string): Promise<void> {
  await window.arc.threads.delete({ threadId })
}

export async function toggleThreadPin(threadId: string, isPinned: boolean): Promise<void> {
  await window.arc.threads.update({ threadId, patch: { pinned: !isPinned } })
}

export async function removeThreadFromFolder(threadId: string): Promise<void> {
  await window.arc.threads.moveToRoot({ threadId })
}

export async function moveThreadToFolder(threadId: string, folderId: string): Promise<void> {
  await window.arc.threads.moveToFolder({ threadId, folderId })
}

export async function folderThreads(threadIds: string[], name?: string): Promise<{ id: string }> {
  const folder = await window.arc.threads.folderThreads({ threadIds, name })
  return { id: folder.id }
}

export async function duplicateThread(threadId: string, upToMessageId?: string): Promise<void> {
  await window.arc.threads.duplicate({ threadId, upToMessageId })
}
