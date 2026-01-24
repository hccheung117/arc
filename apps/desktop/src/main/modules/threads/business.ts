/**
 * Threads Business Logic
 *
 * Single source of truth for thread hierarchy operations.
 * Absorbs lib/messages/commands, lib/messages/threads, lib/messages/tree.
 * Uses deps.messages for data operations (delete, duplicate).
 */

import { createId } from '@paralleldrive/cuid2'
import type { StoredThread, StoredThreadIndex, PromptSource } from './json-file'
// eslint-disable-next-line no-restricted-imports -- Temporary: schema for storage instance until full cap-based migration
import { StoredThreadIndexSchema } from './json-file'
// eslint-disable-next-line no-restricted-imports -- Temporary: storage instance until full cap-based migration
import { JsonFile } from '@main/foundation/json-file'
import { getThreadIndexPath } from '@main/kernel/paths.tmp'

// ============================================================================
// STORAGE
// ============================================================================

const threadIndexFile = () =>
  new JsonFile<StoredThreadIndex>(getThreadIndexPath(), { threads: [] }, StoredThreadIndexSchema)

const threadStorage = {
  read: () => threadIndexFile().read(),
  write: (data: StoredThreadIndex) => threadIndexFile().write(data),
  update: (updater: (data: StoredThreadIndex) => StoredThreadIndex) => threadIndexFile().update(updater),
}

// ============================================================================
// TYPES
// ============================================================================

export type ThreadPatch = {
  title?: string
  pinned?: boolean
  promptSource?: PromptSource
}

export type ThreadEvent =
  | { type: 'created'; thread: StoredThread }
  | { type: 'updated'; thread: StoredThread }
  | { type: 'deleted'; id: string }

export type Effect<T> = {
  result: T
  events: ThreadEvent[]
}

type MessagesDep = {
  deleteData: (input: { threadId: string }) => Promise<void>
  duplicateData: (input: { sourceId: string; targetId: string; upToMessageId?: string }) => Promise<void>
}

// ============================================================================
// TREE PRIMITIVES
// ============================================================================

function find(tree: StoredThread[], p: (t: StoredThread) => boolean): StoredThread | undefined {
  for (const t of tree) {
    if (p(t)) return t
    const found = find(t.children, p)
    if (found) return found
  }
}

export function findById(tree: StoredThread[], id: string): StoredThread | undefined {
  return find(tree, (t) => t.id === id)
}

function parentOf(tree: StoredThread[], childId: string): StoredThread | undefined {
  for (const t of tree) {
    if (t.children.some((c) => c.id === childId)) return t
    const found = parentOf(t.children, childId)
    if (found) return found
  }
}

function updateById(
  tree: StoredThread[],
  id: string,
  fn: (t: StoredThread) => StoredThread,
): StoredThread[] {
  return tree.map((t) =>
    t.id === id ? fn(t) : { ...t, children: updateById(t.children, id, fn) },
  )
}

function extract(tree: StoredThread[], id: string): [StoredThread | undefined, StoredThread[]] {
  const idx = tree.findIndex((t) => t.id === id)
  if (idx !== -1) {
    return [tree[idx], [...tree.slice(0, idx), ...tree.slice(idx + 1)]]
  }

  let extracted: StoredThread | undefined
  const remaining = tree.map((t) => {
    if (extracted) return t
    const [found, children] = extract(t.children, id)
    if (found) {
      extracted = found
      return { ...t, children }
    }
    return t
  })

  return [extracted, remaining]
}

// ============================================================================
// THREAD TRANSFORMS
// ============================================================================

const now = () => new Date().toISOString()

const unpin = (t: StoredThread): StoredThread => ({ ...t, pinned: false })

interface NewThreadConfig {
  title: string
  renamed: boolean
  promptSource: PromptSource
  children: StoredThread[]
}

const createThreadEntry = (config: NewThreadConfig): StoredThread => {
  const timestamp = now()
  return {
    id: createId(),
    title: config.title,
    pinned: false,
    renamed: config.renamed,
    promptSource: config.promptSource,
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
    ...(patch.promptSource !== undefined && { promptSource: patch.promptSource, updatedAt: now() }),
  })

const removeThread =
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
  const { threads } = await threadStorage.read()
  return [...threads].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
}

// ============================================================================
// COMMAND HANDLERS
// ============================================================================

export async function executeDelete(
  messages: MessagesDep,
  threadId: string,
): Promise<Effect<void>> {
  await threadStorage.update(removeThread(threadId))
  await messages.deleteData({ threadId })
  return { result: undefined, events: [{ type: 'deleted', id: threadId }] }
}

export async function executeUpdate(
  threadId: string,
  patch: ThreadPatch,
): Promise<Effect<StoredThread>> {
  let result: StoredThread | undefined

  await threadStorage.update((index) => {
    const thread = findById(index.threads, threadId)
    if (!thread) throw new Error(`Thread not found: ${threadId}`)

    if (patch.pinned && parentOf(index.threads, threadId)) {
      throw new Error('Cannot pin a thread inside a folder')
    }

    result = applyPatch(patch)(thread)
    return { threads: updateById(index.threads, threadId, () => result!) }
  })

  if (!result) throw new Error(`Failed to update thread: ${threadId}`)
  return { result, events: [{ type: 'updated', thread: result }] }
}

export async function executeDuplicate(
  messages: MessagesDep,
  threadId: string,
  upToMessageId?: string,
): Promise<Effect<StoredThread>> {
  let duplicate: StoredThread | undefined
  let parentFolder: StoredThread | undefined

  await threadStorage.update((index) => {
    const source = findById(index.threads, threadId)
    if (!source) throw new Error(`Thread not found: ${threadId}`)

    if (source.children.length > 0) {
      throw new Error('Cannot duplicate a folder')
    }

    duplicate = createThreadEntry({
      title: `${source.title ?? 'New Chat'} (Copy)`,
      renamed: source.renamed,
      promptSource: source.promptSource,
      children: [],
    })

    const parent = parentOf(index.threads, threadId)

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

  await messages.duplicateData({ sourceId: threadId, targetId: duplicate.id, upToMessageId })

  const events: ThreadEvent[] = [{ type: 'created', thread: duplicate }]
  if (parentFolder) {
    events.push({ type: 'updated', thread: parentFolder })
  }

  return { result: duplicate, events }
}

// ============================================================================
// FOLDER OPERATIONS
// ============================================================================

export async function executeCreateFolder(
  name: string,
  threadIds: [string, string],
): Promise<Effect<StoredThread>> {
  let folder: StoredThread | undefined

  await threadStorage.update((index) => {
    const [t1, after1] = extract(index.threads, threadIds[0])
    if (!t1) throw new Error(`Thread not found: ${threadIds[0]}`)

    const [t2, after2] = extract(after1, threadIds[1])
    if (!t2) throw new Error(`Thread not found: ${threadIds[1]}`)

    folder = createThreadEntry({
      title: name,
      renamed: true,
      promptSource: { type: 'none' },
      children: [unpin(t1), unpin(t2)],
    })

    return { threads: [folder, ...after2] }
  })

  if (!folder) throw new Error('Failed to create folder')

  return {
    result: folder,
    events: [
      { type: 'deleted', id: threadIds[0] },
      { type: 'deleted', id: threadIds[1] },
      { type: 'created', thread: folder },
    ],
  }
}

export async function executeCreateFolderWithThread(
  threadId: string,
): Promise<Effect<StoredThread>> {
  let folder: StoredThread | undefined

  await threadStorage.update((index) => {
    const [thread, remaining] = extract(index.threads, threadId)
    if (!thread) throw new Error(`Thread not found: ${threadId}`)

    const folderCount = index.threads.filter((t) => t.children.length > 0).length

    folder = createThreadEntry({
      title: `Folder ${folderCount + 1}`,
      renamed: false,
      promptSource: { type: 'none' },
      children: [unpin(thread)],
    })

    return { threads: [folder, ...remaining] }
  })

  if (!folder) throw new Error('Failed to create folder')

  return {
    result: folder,
    events: [
      { type: 'deleted', id: threadId },
      { type: 'created', thread: folder },
    ],
  }
}

export async function executeMoveToFolder(
  threadId: string,
  folderId: string,
): Promise<Effect<StoredThread | undefined>> {
  let targetFolder: StoredThread | undefined
  let sourceFolder: StoredThread | undefined

  await threadStorage.update((index) => {
    if (!findById(index.threads, folderId)) {
      throw new Error(`Folder not found: ${folderId}`)
    }

    const parent = parentOf(index.threads, threadId)
    const [thread, remaining] = extract(index.threads, threadId)
    if (!thread) throw new Error(`Thread not found: ${threadId}`)

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

  if (!targetFolder) return { result: undefined, events: [] }

  const events: ThreadEvent[] = []

  if (sourceFolder) {
    if (sourceFolder.children.length === 0) {
      await threadStorage.update(removeThread(sourceFolder.id))
      events.push({ type: 'deleted', id: sourceFolder.id })
    } else {
      events.push({ type: 'updated', thread: sourceFolder })
    }
  } else {
    events.push({ type: 'deleted', id: threadId })
  }

  events.push({ type: 'updated', thread: targetFolder })

  return { result: targetFolder, events }
}

export async function executeMoveToRoot(
  threadId: string,
): Promise<Effect<StoredThread | undefined>> {
  let moved: StoredThread | undefined
  let updatedParent: StoredThread | undefined

  await threadStorage.update((index) => {
    const parent = parentOf(index.threads, threadId)
    if (!parent) return index

    const [thread, remaining] = extract(index.threads, threadId)
    if (!thread) throw new Error(`Thread not found: ${threadId}`)

    moved = thread
    updatedParent = { ...parent, children: parent.children.filter(c => c.id !== threadId), updatedAt: now() }
    const withUpdatedParent = updateById(remaining, parent.id, () => updatedParent!)

    return { threads: [...withUpdatedParent, thread] }
  })

  if (!moved || !updatedParent) return { result: undefined, events: [] }

  const events: ThreadEvent[] = []

  if (updatedParent.children.length === 0) {
    await threadStorage.update(removeThread(updatedParent.id))
    events.push({ type: 'deleted', id: updatedParent.id })
  } else {
    events.push({ type: 'updated', thread: updatedParent })
  }

  events.push({ type: 'created', thread: moved })

  return { result: moved, events }
}

export async function executeReorderInFolder(
  folderId: string,
  orderedIds: string[],
): Promise<Effect<StoredThread | undefined>> {
  let updatedFolder: StoredThread | undefined

  await threadStorage.update((index) => {
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

  if (!updatedFolder) return { result: undefined, events: [] }

  return { result: updatedFolder, events: [{ type: 'updated', thread: updatedFolder }] }
}
