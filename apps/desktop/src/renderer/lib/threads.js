import { createId } from '@paralleldrive/cuid2'

// ============================================================================
// CHAT THREAD
// ============================================================================

/**
 * Create a new draft thread for "New Chat"
 *
 * Draft threads use a generated cuid2 ID which will become the
 * database conversationId once persisted.
 */
export function createDraftThread(options) {
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
export function hydrateThread(thread) {
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
 * Extract thread config from a ChatThread for handoff.
 * Only used when owner='local' to bundle config with first message.
 */
export function extractThreadConfig(thread) {
  return {
    prompt: thread.prompt,
  }
}

// ============================================================================
// IPC WRAPPERS
// ============================================================================

export async function getThreads() {
  const threads = await window.arc.threads.list()
  return threads.map(hydrateThread)
}

export async function renameThread(threadId, title) {
  await window.arc.threads.update({ threadId, patch: { title } })
}

export function onThreadEvent(callback) {
  return window.arc.threads.onEvent(callback)
}

/**
 * Shows thread context menu and returns the selected action.
 * The caller is responsible for calling the appropriate domain IPC based on the action.
 */
export async function showThreadContextMenu(
  params
) {
  return window.arc.ui.showThreadContextMenu(params)
}

// ============================================================================
// DOMAIN IPC WRAPPERS
// ============================================================================

export async function deleteThread(threadId) {
  await window.arc.threads.delete({ threadId })
}

export async function toggleThreadPin(threadId, isPinned) {
  await window.arc.threads.update({ threadId, patch: { pinned: !isPinned } })
}

export async function removeThreadFromFolder(threadId) {
  await window.arc.threads.moveToRoot({ threadId })
}

export async function moveThreadToFolder(threadId, folderId) {
  await window.arc.threads.moveToFolder({ threadId, folderId })
}

export async function folderThreads(threadIds, name) {
  const folder = await window.arc.threads.folderThreads({ threadIds, name })
  return { id: folder.id }
}

export async function duplicateThread(threadId, upToMessageId) {
  await window.arc.threads.duplicate({ threadId, upToMessageId })
}
