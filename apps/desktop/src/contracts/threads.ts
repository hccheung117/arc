/**
 * Threads & Folders Contract
 *
 * Thread CRUD and folder organization operations.
 */

import { z } from 'zod'
import { contract, op, returns } from '@main/foundation/contract'
import type { StoredThread } from '@boundary/messages'

// ============================================================================
// SCHEMAS
// ============================================================================

export const ThreadPatchSchema = z.object({
  title: z.string().optional(),
  pinned: z.boolean().optional(),
  systemPrompt: z.string().nullable().optional(),
})

// ============================================================================
// THREADS CONTRACT
// ============================================================================

export const threadsContract = contract('threads', {
  /** List all threads with nested folder structure */
  list: op(z.void(), [] as StoredThread[]),

  /** Update thread properties */
  update: op(
    z.object({
      threadId: z.string(),
      patch: ThreadPatchSchema,
    }),
    returns<StoredThread>(),
  ),

  /** Delete a thread and all its messages */
  delete: op(z.object({ threadId: z.string() }), undefined as void),

  /** Duplicate a thread, optionally up to a specific message */
  duplicate: op(
    z.object({
      threadId: z.string(),
      upToMessageId: z.string().optional(),
    }),
    returns<StoredThread>(),
  ),
})

// ============================================================================
// FOLDERS CONTRACT
// ============================================================================

export const foldersContract = contract('folders', {
  /** Create a folder from two threads */
  create: op(
    z.object({
      name: z.string(),
      threadId1: z.string(),
      threadId2: z.string(),
    }),
    returns<StoredThread>(),
  ),

  /** Create a folder containing a single thread */
  createWithThread: op(
    z.object({ threadId: z.string() }),
    returns<StoredThread>(),
  ),

  /** Move a thread into a folder */
  moveThread: op(
    z.object({
      threadId: z.string(),
      folderId: z.string(),
    }),
    undefined as void,
  ),

  /** Move a thread out of its folder to root */
  moveToRoot: op(z.object({ threadId: z.string() }), undefined as void),

  /** Reorder threads within a folder */
  reorder: op(
    z.object({
      folderId: z.string(),
      orderedChildIds: z.array(z.string()),
    }),
    undefined as void,
  ),
})

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type ThreadPatch = z.infer<typeof ThreadPatchSchema>
export type { StoredThread as Thread }
