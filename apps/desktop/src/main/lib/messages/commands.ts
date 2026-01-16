/**
 * Thread Commands
 *
 * Single source of truth for all thread operations.
 * Each command returns an Effect<T> containing the result and events to broadcast.
 * The app layer just executes commands and broadcasts returned events.
 */

import type { ThreadPatch } from '@contracts/threads'
import type { StoredThread } from './schemas'
import {
  listThreads,
  deleteThread,
  updateThread,
  createFolder,
  createFolderWithThread,
  moveToFolder,
  moveToRoot,
  reorderInFolder,
  duplicateThread,
} from './threads'

// ============================================================================
// TYPES
// ============================================================================

export type ThreadEvent =
  | { type: 'created'; thread: StoredThread }
  | { type: 'updated'; thread: StoredThread }
  | { type: 'deleted'; id: string }

export type Effect<T> = {
  result: T
  events: ThreadEvent[]
}

export type ThreadCommand =
  | { type: 'delete'; threadId: string }
  | { type: 'update'; threadId: string; patch: ThreadPatch }
  | { type: 'duplicate'; threadId: string; upToMessageId?: string }
  | { type: 'move-to-folder'; threadId: string; folderId: string }
  | { type: 'move-to-root'; threadId: string }
  | { type: 'create-folder'; name: string; threadIds: [string, string] }
  | { type: 'create-folder-with-thread'; threadId: string }
  | { type: 'reorder-in-folder'; folderId: string; orderedIds: string[] }

// ============================================================================
// COMMAND EXECUTION
// ============================================================================

/**
 * Executes a thread command and returns the effect (result + events).
 * This is the SINGLE SOURCE OF TRUTH for what events each operation produces.
 */
export async function execute(cmd: ThreadCommand): Promise<Effect<unknown>> {
  switch (cmd.type) {
    case 'delete':
      return executeDelete(cmd.threadId)

    case 'update':
      return executeUpdate(cmd.threadId, cmd.patch)

    case 'duplicate':
      return executeDuplicate(cmd.threadId, cmd.upToMessageId)

    case 'move-to-folder':
      return executeMoveToFolder(cmd.threadId, cmd.folderId)

    case 'move-to-root':
      return executeMoveToRoot(cmd.threadId)

    case 'create-folder':
      return executeCreateFolder(cmd.name, cmd.threadIds)

    case 'create-folder-with-thread':
      return executeCreateFolderWithThread(cmd.threadId)

    case 'reorder-in-folder':
      return executeReorderInFolder(cmd.folderId, cmd.orderedIds)
  }
}

// ============================================================================
// COMMAND HANDLERS
// ============================================================================

async function executeDelete(threadId: string): Promise<Effect<void>> {
  await deleteThread(threadId)
  return {
    result: undefined,
    events: [{ type: 'deleted', id: threadId }],
  }
}

async function executeUpdate(threadId: string, patch: ThreadPatch): Promise<Effect<StoredThread>> {
  const thread = await updateThread(threadId, patch)
  return {
    result: thread,
    events: [{ type: 'updated', thread }],
  }
}

async function executeDuplicate(
  threadId: string,
  upToMessageId?: string,
): Promise<Effect<StoredThread>> {
  const result = await duplicateThread(threadId, upToMessageId)

  const events: ThreadEvent[] = [{ type: 'created', thread: result.duplicate }]

  if (result.parentFolder) {
    events.push({ type: 'updated', thread: result.parentFolder })
  }

  return { result: result.duplicate, events }
}

async function executeMoveToFolder(
  threadId: string,
  folderId: string,
): Promise<Effect<StoredThread | undefined>> {
  const result = await moveToFolder(threadId, folderId)
  if (!result) {
    return { result: undefined, events: [] }
  }

  const events: ThreadEvent[] = []

  // Event 1: Source folder updated (if thread was in a folder)
  // OR thread deleted from root (if thread was at root level)
  if (result.sourceFolder) {
    // Check if source folder is now empty and should be auto-deleted
    if (result.sourceFolder.children.length === 0) {
      await deleteThread(result.sourceFolder.id)
      events.push({ type: 'deleted', id: result.sourceFolder.id })
    } else {
      events.push({ type: 'updated', thread: result.sourceFolder })
    }
  } else {
    // Thread was at root level - signal removal from root
    events.push({ type: 'deleted', id: threadId })
  }

  // Event 2: Target folder updated with new child
  events.push({ type: 'updated', thread: result.targetFolder })

  return { result: result.targetFolder, events }
}

async function executeMoveToRoot(threadId: string): Promise<Effect<StoredThread | undefined>> {
  const result = await moveToRoot(threadId)
  if (!result) {
    return { result: undefined, events: [] }
  }

  const events: ThreadEvent[] = []

  // Check if parent folder is now empty and should be auto-deleted
  if (result.updatedParent.children.length === 0) {
    await deleteThread(result.updatedParent.id)
    events.push({ type: 'deleted', id: result.updatedParent.id })
  } else {
    events.push({ type: 'updated', thread: result.updatedParent })
  }

  // Signal thread appeared at root (using 'created' since it's new at root level)
  events.push({ type: 'created', thread: result.moved })

  return { result: result.moved, events }
}

async function executeCreateFolder(
  name: string,
  threadIds: [string, string],
): Promise<Effect<StoredThread>> {
  const folder = await createFolder(name, threadIds[0], threadIds[1])

  const events: ThreadEvent[] = [
    // Both threads removed from root
    { type: 'deleted', id: threadIds[0] },
    { type: 'deleted', id: threadIds[1] },
    // New folder created
    { type: 'created', thread: folder },
  ]

  return { result: folder, events }
}

async function executeCreateFolderWithThread(threadId: string): Promise<Effect<StoredThread>> {
  const { folder } = await createFolderWithThread(threadId)

  const events: ThreadEvent[] = [
    // Thread removed from root
    { type: 'deleted', id: threadId },
    // New folder created
    { type: 'created', thread: folder },
  ]

  return { result: folder, events }
}

async function executeReorderInFolder(
  folderId: string,
  orderedIds: string[],
): Promise<Effect<StoredThread | undefined>> {
  const folder = await reorderInFolder(folderId, orderedIds)
  if (!folder) {
    return { result: undefined, events: [] }
  }

  return {
    result: folder,
    events: [{ type: 'updated', thread: folder }],
  }
}

// ============================================================================
// QUERIES (Read-only, no events)
// ============================================================================

export { listThreads }
