/**
 * Thread Operations
 *
 * Pure domain logic for thread hierarchy. Returns results only—no IPC, no events.
 * Event emission belongs in app/ layer.
 */

import { createId } from '@paralleldrive/cuid2'
import type { ThreadPatch } from '@arc-types/arc-api'
import type { StoredThread, StoredThreadIndex } from './schemas'
import { threadIndexFile, messageLogFile, deleteThreadAttachments } from './storage'

// ============================================================================
// TREE PRIMITIVES (Pure)
// ============================================================================

type Tree = StoredThread[]

/** Finds first thread matching predicate, depth-first */
const find =
  (p: (t: StoredThread) => boolean) =>
  (tree: Tree): StoredThread | undefined => {
    for (const t of tree) {
      if (p(t)) return t
      const found = find(p)(t.children)
      if (found) return found
    }
  }

/** Finds parent of a thread by child id */
const parentOf =
  (childId: string) =>
  (tree: Tree): StoredThread | undefined => {
    for (const t of tree) {
      if (t.children.some((c) => c.id === childId)) return t
      const found = parentOf(childId)(t.children)
      if (found) return found
    }
  }

/** Updates a thread by id immutably, returning new tree */
const updateById =
  (id: string, fn: (t: StoredThread) => StoredThread) =>
  (tree: Tree): Tree =>
    tree.map((t) =>
      t.id === id ? fn(t) : { ...t, children: updateById(id, fn)(t.children) },
    )

/** Extracts a thread from tree, returns [extracted, remaining] */
const extract =
  (id: string) =>
  (tree: Tree): [StoredThread | undefined, Tree] => {
    const idx = tree.findIndex((t) => t.id === id)
    if (idx !== -1) {
      return [tree[idx], [...tree.slice(0, idx), ...tree.slice(idx + 1)]]
    }

    let extracted: StoredThread | undefined
    const remaining = tree.map((t) => {
      if (extracted) return t
      const [found, children] = extract(id)(t.children)
      if (found) {
        extracted = found
        return { ...t, children }
      }
      return t
    })

    return [extracted, remaining]
  }

// Convenience
const findById = (id: string) => find((t) => t.id === id)

// ============================================================================
// THREAD TRANSFORMS (Pure)
// ============================================================================

const now = () => new Date().toISOString()

const unpin = (t: StoredThread): StoredThread => ({ ...t, pinned: false })

const applyPatch =
  (patch: ThreadPatch) =>
  (t: StoredThread): StoredThread => ({
    ...t,
    ...(patch.title !== undefined && { title: patch.title, renamed: true, updatedAt: now() }),
    ...(patch.pinned !== undefined && { pinned: patch.pinned }),
  })

/** Removes thread, moving its children to root */
export const removeThread =
  (id: string) =>
  (index: StoredThreadIndex): StoredThreadIndex => {
    const thread = findById(id)(index.threads)
    if (!thread) return index

    const [, remaining] = extract(id)(index.threads)
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
    const thread = findById(id)(index.threads)
    if (!thread) throw new Error(`Thread not found: ${id}`)

    if (patch.pinned && parentOf(id)(index.threads)) {
      throw new Error('Cannot pin a thread inside a folder')
    }

    result = applyPatch(patch)(thread)
    return { threads: updateById(id, () => result!)(index.threads) }
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
    const [t1, after1] = extract(id1)(index.threads)
    if (!t1) throw new Error(`Thread not found: ${id1}`)

    const [t2, after2] = extract(id2)(after1)
    if (!t2) throw new Error(`Thread not found: ${id2}`)

    const timestamp = now()
    folder = {
      id: createId(),
      title: name,
      pinned: false,
      renamed: true,
      createdAt: timestamp,
      updatedAt: timestamp,
      children: [unpin(t1), unpin(t2)],
    }

    return { threads: [folder, ...after2] }
  })

  if (!folder) throw new Error('Failed to create folder')
  return folder
}

export async function moveToFolder(threadId: string, folderId: string): Promise<StoredThread | undefined> {
  let updatedFolder: StoredThread | undefined

  await threadIndexFile().update((index) => {
    if (!findById(folderId)(index.threads)) {
      throw new Error(`Folder not found: ${folderId}`)
    }

    const [thread, remaining] = extract(threadId)(index.threads)
    if (!thread) throw new Error(`Thread not found: ${threadId}`)

    const appendChild = (folder: StoredThread): StoredThread => {
      updatedFolder = { ...folder, children: [...folder.children, unpin(thread)], updatedAt: now() }
      return updatedFolder
    }

    return { threads: updateById(folderId, appendChild)(remaining) }
  })

  return updatedFolder
}

export async function moveToRoot(threadId: string): Promise<void> {
  await threadIndexFile().update((index) => {
    if (!parentOf(threadId)(index.threads)) return index

    const [thread, remaining] = extract(threadId)(index.threads)
    if (!thread) throw new Error(`Thread not found: ${threadId}`)

    return { threads: [...remaining, thread] }
  })
}

export async function reorderInFolder(folderId: string, orderedIds: string[]): Promise<StoredThread | undefined> {
  let updatedFolder: StoredThread | undefined

  await threadIndexFile().update((index) => {
    const folder = findById(folderId)(index.threads)
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

    return { threads: updateById(folderId, reorder)(index.threads) }
  })

  return updatedFolder
}
