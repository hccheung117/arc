/**
 * Thread Operations
 *
 * Thread reads and index transformations.
 * Thread mutations (rename, pin) are app-layer workflows.
 */

import type { StoredThread, StoredThreadIndex } from './schemas'
import { threadIndexFile } from './storage'

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
// THREAD INDEX TRANSFORMERS
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
