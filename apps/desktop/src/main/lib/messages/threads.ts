/**
 * Thread Operations
 *
 * Thread reads, transformations, and lifecycle operations.
 */

import type { ThreadPatch } from '@arc-types/arc-api'
import type { StoredThread, StoredThreadIndex } from './schemas'
import { threadIndexFile, messageLogFile, deleteThreadAttachments } from './storage'
import { broadcast } from '@main/foundation/ipc'

// ============================================================================
// READS
// ============================================================================

/**
 * Returns all threads sorted by updatedAt (most recent first).
 */
export async function listThreads(): Promise<StoredThread[]> {
  const index = await threadIndexFile().read()

  return [...index.threads].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
}

/**
 * Checks if a thread exists.
 */
export async function threadExists(threadId: string): Promise<boolean> {
  const index = await threadIndexFile().read()
  return index.threads.some((t) => t.id === threadId)
}

// ============================================================================
// TRANSFORMERS
// ============================================================================

/**
 * Removes a thread from the index.
 */
export function removeThread(
  index: StoredThreadIndex,
  threadId: string,
): StoredThreadIndex {
  return { threads: index.threads.filter((t) => t.id !== threadId) }
}

// ============================================================================
// EVENTS
// ============================================================================

export type ThreadEvent =
  | { type: 'created'; thread: StoredThread }
  | { type: 'updated'; thread: StoredThread }
  | { type: 'deleted'; id: string }

export function emitThreadEvent(event: ThreadEvent): void {
  broadcast('arc:threads:event', event)
}

// ============================================================================
// MUTATIONS
// ============================================================================

export async function deleteThread(threadId: string): Promise<void> {
  await threadIndexFile().update((index) => removeThread(index, threadId))
  await messageLogFile(threadId).delete()
  await deleteThreadAttachments(threadId)
  emitThreadEvent({ type: 'deleted', id: threadId })
}

export async function updateThread(threadId: string, patch: ThreadPatch): Promise<StoredThread> {
  let updatedThread: StoredThread | undefined

  await threadIndexFile().update((index) => {
    const thread = index.threads.find((t) => t.id === threadId)
    if (!thread) throw new Error(`Thread not found: ${threadId}`)

    if (patch.title !== undefined) {
      thread.title = patch.title
      thread.renamed = true
      thread.updatedAt = new Date().toISOString()
    }
    if (patch.pinned !== undefined) {
      thread.pinned = patch.pinned
      // Pinning is organizational metadata—don't update timestamp
    }
    updatedThread = thread
    return index
  })

  if (!updatedThread) throw new Error(`Failed to update thread: ${threadId}`)
  emitThreadEvent({ type: 'updated', thread: updatedThread })
  return updatedThread
}
