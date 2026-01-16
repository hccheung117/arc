/**
 * Thread Operations
 *
 * Pure domain logic for thread hierarchy. Returns results only—no IPC, no events.
 * Event emission belongs in app/ layer.
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import { createId } from '@paralleldrive/cuid2'
import type { ThreadPatch } from '@main/contracts/threads'
import type { StoredThread, StoredThreadIndex, StoredMessageEvent } from './schemas'
import { threadIndexFile, messageLogFile, deleteThreadAttachments } from './storage'
import { findById, parentOf, updateById, extract } from './tree'
import { reduceMessageEvents } from './reducer'
import { getMessageLogPath, getThreadAttachmentsDir } from '@main/foundation/paths'

// ============================================================================
// THREAD TRANSFORMS (Pure)
// ============================================================================

const now = () => new Date().toISOString()

const unpin = (t: StoredThread): StoredThread => ({ ...t, pinned: false })

interface NewThreadConfig {
  title: string
  renamed: boolean
  systemPrompt: string | null
  children: StoredThread[]
}

/** Factory for creating new thread entries with generated ID and timestamps */
const createThreadEntry = (config: NewThreadConfig): StoredThread => {
  const timestamp = now()
  return {
    id: createId(),
    title: config.title,
    pinned: false,
    renamed: config.renamed,
    systemPrompt: config.systemPrompt,
    createdAt: timestamp,
    updatedAt: timestamp,
    children: config.children,
  }
}

const applyPatch =
  (patch: ThreadPatch) =>
  (t: StoredThread): StoredThread => ({
    ...t,
    ...(patch.title !== undefined && { title: patch.title, renamed: true, updatedAt: now() }),
    ...(patch.pinned !== undefined && { pinned: patch.pinned }),
    ...(patch.systemPrompt !== undefined && { systemPrompt: patch.systemPrompt, updatedAt: now() }),
  })

/** Removes thread, moving its children to root */
export const removeThread =
  (id: string) =>
  (index: StoredThreadIndex): StoredThreadIndex => {
    const thread = findById(index.threads, id)
    if (!thread) return index

    const [, remaining] = extract(index.threads, id)
    return { threads: [...remaining, ...thread.children] }
  }

// ============================================================================
// QUERIES
// ============================================================================

export async function listThreads(): Promise<StoredThread[]> {
  const { threads } = await threadIndexFile().read()
  return [...threads].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
}

// ============================================================================
// MUTATIONS
// ============================================================================

export async function deleteThread(id: string): Promise<void> {
  await threadIndexFile().update(removeThread(id))
  await messageLogFile(id).delete()
  await deleteThreadAttachments(id)
}

export async function updateThread(id: string, patch: ThreadPatch): Promise<StoredThread> {
  let result: StoredThread | undefined

  await threadIndexFile().update((index) => {
    const thread = findById(index.threads, id)
    if (!thread) throw new Error(`Thread not found: ${id}`)

    if (patch.pinned && parentOf(index.threads, id)) {
      throw new Error('Cannot pin a thread inside a folder')
    }

    result = applyPatch(patch)(thread)
    return { threads: updateById(index.threads, id, () => result!) }
  })

  if (!result) throw new Error(`Failed to update thread: ${id}`)
  return result
}

// ============================================================================
// FOLDER OPERATIONS
// ============================================================================

export async function createFolder(
  name: string,
  id1: string,
  id2: string,
): Promise<StoredThread> {
  let folder: StoredThread | undefined

  await threadIndexFile().update((index) => {
    const [t1, after1] = extract(index.threads, id1)
    if (!t1) throw new Error(`Thread not found: ${id1}`)

    const [t2, after2] = extract(after1, id2)
    if (!t2) throw new Error(`Thread not found: ${id2}`)

    folder = createThreadEntry({
      title: name,
      renamed: true,
      systemPrompt: null,
      children: [unpin(t1), unpin(t2)],
    })

    return { threads: [folder, ...after2] }
  })

  if (!folder) throw new Error('Failed to create folder')
  return folder
}

/** Creates a folder with a single thread. Returns both the folder and the folder count for naming. */
export async function createFolderWithThread(
  threadId: string,
): Promise<{ folder: StoredThread }> {
  let folder: StoredThread | undefined

  await threadIndexFile().update((index) => {
    const [thread, remaining] = extract(index.threads, threadId)
    if (!thread) throw new Error(`Thread not found: ${threadId}`)

    // Count existing folders for naming
    const folderCount = index.threads.filter((t) => t.children.length > 0).length

    folder = createThreadEntry({
      title: `Folder ${folderCount + 1}`,
      renamed: false,
      systemPrompt: null,
      children: [unpin(thread)],
    })

    return { threads: [folder, ...remaining] }
  })

  if (!folder) throw new Error('Failed to create folder')
  return { folder }
}

export async function moveToFolder(threadId: string, folderId: string): Promise<{ targetFolder: StoredThread; sourceFolder?: StoredThread } | undefined> {
  let targetFolder: StoredThread | undefined
  let sourceFolder: StoredThread | undefined

  await threadIndexFile().update((index) => {
    if (!findById(index.threads, folderId)) {
      throw new Error(`Folder not found: ${folderId}`)
    }

    // Check if thread is currently in a folder (for cross-folder moves)
    const parent = parentOf(index.threads, threadId)

    const [thread, remaining] = extract(index.threads, threadId)
    if (!thread) throw new Error(`Thread not found: ${threadId}`)

    // Update source folder if thread was in one
    let withUpdatedSource = remaining
    if (parent) {
      sourceFolder = { ...parent, children: parent.children.filter(c => c.id !== threadId), updatedAt: now() }
      withUpdatedSource = updateById(remaining, parent.id, () => sourceFolder!)
    }

    const appendChild = (folder: StoredThread): StoredThread => {
      targetFolder = { ...folder, children: [...folder.children, unpin(thread)], updatedAt: now() }
      return targetFolder
    }

    return { threads: updateById(withUpdatedSource, folderId, appendChild) }
  })

  return targetFolder ? { targetFolder, sourceFolder } : undefined
}

export async function moveToRoot(threadId: string): Promise<{ moved: StoredThread; updatedParent: StoredThread } | undefined> {
  let moved: StoredThread | undefined
  let updatedParent: StoredThread | undefined

  await threadIndexFile().update((index) => {
    const parent = parentOf(index.threads, threadId)
    if (!parent) return index

    const [thread, remaining] = extract(index.threads, threadId)
    if (!thread) throw new Error(`Thread not found: ${threadId}`)

    moved = thread
    // Update the parent folder to reflect the child removal
    updatedParent = { ...parent, children: parent.children.filter(c => c.id !== threadId), updatedAt: now() }
    const withUpdatedParent = updateById(remaining, parent.id, () => updatedParent!)

    return { threads: [...withUpdatedParent, thread] }
  })

  return moved && updatedParent ? { moved, updatedParent } : undefined
}

export async function reorderInFolder(folderId: string, orderedIds: string[]): Promise<StoredThread | undefined> {
  let updatedFolder: StoredThread | undefined

  await threadIndexFile().update((index) => {
    const folder = findById(index.threads, folderId)
    if (!folder) throw new Error(`Folder not found: ${folderId}`)

    const childMap = new Map(folder.children.map((c) => [c.id, c]))
    const reordered = orderedIds.map((id) => {
      const child = childMap.get(id)
      if (!child) throw new Error(`Thread ${id} not in folder ${folderId}`)
      return child
    })

    const reorder = (t: StoredThread): StoredThread => {
      updatedFolder = { ...t, children: reordered, updatedAt: now() }
      return updatedFolder
    }

    return { threads: updateById(index.threads, folderId, reorder) }
  })

  return updatedFolder
}

// ============================================================================
// DUPLICATION
// ============================================================================

export interface DuplicateThreadResult {
  duplicate: StoredThread
  parentFolder?: StoredThread
}

/**
 * Duplicates a thread with optional message filtering.
 *
 * - Copies to same location (folder if in folder, root if at root)
 * - Adds " (Copy)" suffix to title
 * - Copies message log (optionally filtered to messages up to upToMessageId)
 * - Copies attachments (selective if filtered)
 */
export async function duplicateThread(
  sourceId: string,
  upToMessageId?: string,
): Promise<DuplicateThreadResult> {
  let duplicate: StoredThread | undefined
  let parentFolder: StoredThread | undefined

  await threadIndexFile().update((index) => {
    const source = findById(index.threads, sourceId)
    if (!source) throw new Error(`Thread not found: ${sourceId}`)

    if (source.children.length > 0) {
      throw new Error('Cannot duplicate a folder')
    }

    duplicate = createThreadEntry({
      title: `${source.title ?? 'New Chat'} (Copy)`,
      renamed: source.renamed,
      systemPrompt: source.systemPrompt,
      children: [],
    })

    const parent = parentOf(index.threads, sourceId)

    if (parent) {
      const appendChild = (folder: StoredThread): StoredThread => {
        parentFolder = { ...folder, children: [...folder.children, duplicate!], updatedAt: now() }
        return parentFolder
      }
      return { threads: updateById(index.threads, parent.id, appendChild) }
    }

    return { threads: [duplicate, ...index.threads] }
  })

  if (!duplicate) throw new Error('Failed to create duplicate')

  await copyThreadData(sourceId, duplicate.id, upToMessageId)

  return { duplicate, parentFolder }
}

/**
 * Copies message log and attachments from source to target thread.
 * If upToMessageId provided, filters to only include the branch path to that message.
 */
async function copyThreadData(
  sourceId: string,
  targetId: string,
  upToMessageId?: string,
): Promise<void> {
  const sourcePath = getMessageLogPath(sourceId)

  try {
    await fs.access(sourcePath)
  } catch {
    return // No messages yet
  }

  if (upToMessageId) {
    const events = await messageLogFile(sourceId).read()
    const { filtered, attachmentPaths } = filterMessageEvents(events, upToMessageId)

    const targetLog = messageLogFile(targetId)
    for (const event of filtered) {
      await targetLog.append(event)
    }

    await copySelectiveAttachments(sourceId, targetId, attachmentPaths)
  } else {
    await fs.copyFile(sourcePath, getMessageLogPath(targetId))

    const sourceAttachmentsDir = getThreadAttachmentsDir(sourceId)
    const targetAttachmentsDir = getThreadAttachmentsDir(targetId)

    try {
      await fs.cp(sourceAttachmentsDir, targetAttachmentsDir, { recursive: true })
    } catch {
      // No attachments directory
    }
  }
}

/**
 * Filters message events to include only those in the branch path
 * leading to upToMessageId (inclusive).
 */
function filterMessageEvents(
  events: StoredMessageEvent[],
  upToMessageId: string,
): { filtered: StoredMessageEvent[]; attachmentPaths: Set<string> } {
  const { messages } = reduceMessageEvents(events)

  const target = messages.find((m) => m.id === upToMessageId)
  if (!target) throw new Error(`Message not found: ${upToMessageId}`)

  const ancestryIds = new Set<string>()
  let current: StoredMessageEvent | undefined = target

  while (current) {
    ancestryIds.add(current.id)
    current = current.parentId ? messages.find((m) => m.id === current!.parentId) : undefined
  }

  const filtered = events.filter((e) => ancestryIds.has(e.id))

  const attachmentPaths = new Set<string>()
  for (const event of filtered) {
    if (event.attachments) {
      for (const att of event.attachments) {
        attachmentPaths.add(att.path)
      }
    }
  }

  return { filtered, attachmentPaths }
}

/**
 * Copies only specific attachment files from source to target thread.
 */
async function copySelectiveAttachments(
  sourceId: string,
  targetId: string,
  paths: Set<string>,
): Promise<void> {
  if (paths.size === 0) return

  const sourceDir = getThreadAttachmentsDir(sourceId)
  const targetDir = getThreadAttachmentsDir(targetId)

  await fs.mkdir(targetDir, { recursive: true })

  for (const relativePath of paths) {
    const sourcePath = path.join(sourceDir, relativePath)
    const targetPath = path.join(targetDir, relativePath)

    try {
      await fs.copyFile(sourcePath, targetPath)
    } catch {
      // Attachment missing - skip
    }
  }
}
