/**
 * Threads Business Logic
 *
 * Pure domain logic for thread hierarchy operations.
 * Zero knowledge of persistence format, paths, or Foundation.
 * Receives storage capability as parameter.
 */

import { createId } from '@paralleldrive/cuid2'

// ============================================================================
// TREE PRIMITIVES
// ============================================================================

function find(tree, p) {
  for (const t of tree) {
    if (p(t)) return t
    const found = find(t.children, p)
    if (found) return found
  }
}

export function findById(tree, id) {
  return find(tree, (t) => t.id === id)
}

function parentOf(tree, childId) {
  for (const t of tree) {
    if (t.children.some((c) => c.id === childId)) return t
    const found = parentOf(t.children, childId)
    if (found) return found
  }
}

function updateById(
  tree,
  id,
  fn,
) {
  return tree.map((t) =>
    t.id === id ? fn(t) : { ...t, children: updateById(t.children, id, fn) },
  )
}

function extract(tree, id) {
  const idx = tree.findIndex((t) => t.id === id)
  if (idx !== -1) {
    return [tree[idx], [...tree.slice(0, idx), ...tree.slice(idx + 1)]]
  }

  return tree.reduce(
    ([found, acc], t) => {
      if (found) return [found, [...acc, t]]
      const [extracted, children] = extract(t.children, id)
      return extracted
        ? [extracted, [...acc, { ...t, children }]]
        : [undefined, [...acc, t]]
    },
    [undefined, []],
  )
}

// ============================================================================
// THREAD TRANSFORMS
// ============================================================================

const now = () => new Date().toISOString()

const unpin = (t) => ({ ...t, pinned: false })

const removeChildFromParent = (parent, childId) => ({
  ...parent,
  children: parent.children.filter((c) => c.id !== childId),
  updatedAt: now(),
})

const appendToFolder = (folder, child) => ({
  ...folder,
  children: [...folder.children, unpin(child)],
  updatedAt: now(),
})

const createThreadEntry = (config) => {
  const timestamp = now()
  return {
    id: createId(),
    title: config.title,
    pinned: false,
    renamed: config.renamed,
    prompt: config.prompt,
    createdAt: timestamp,
    updatedAt: timestamp,
    children: config.children,
  }
}

const applyPatch =
  (patch) =>
  (t) => ({
    ...t,
    ...(patch.title !== undefined && { title: patch.title, renamed: true, updatedAt: now() }),
    ...(patch.pinned !== undefined && { pinned: patch.pinned }),
    ...(patch.prompt !== undefined && { prompt: patch.prompt, updatedAt: now() }),
  })

const removeThread =
  (id) =>
  (index) => {
    const thread = findById(index.threads, id)
    if (!thread) return index
    const [, remaining] = extract(index.threads, id)
    return { threads: [...remaining, ...thread.children] }
  }

// ============================================================================
// QUERIES
// ============================================================================

export async function listThreads(storage) {
  const { threads } = await storage.read()
  return [...threads].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
}

// ============================================================================
// EFFECT HELPERS
// ============================================================================

async function handleFolderAfterRemoval(
  storage,
  folder,
) {
  if (folder.children.length === 0) {
    await storage.update(removeThread(folder.id))
    return { type: 'deleted', id: folder.id }
  }
  return { type: 'updated', thread: folder }
}

// ============================================================================
// COMMAND HANDLERS
// ============================================================================

export async function executeCreate(
  storage,
  threadId,
  config,
) {
  let thread
  let created = false

  await storage.update((index) => {
    const existing = findById(index.threads, threadId)
    if (existing) {
      thread = existing
      return index
    }

    const timestamp = now()
    thread = {
      id: threadId,
      title: config.title ?? null,
      pinned: false,
      renamed: false,
      prompt: config.prompt,
      createdAt: timestamp,
      updatedAt: timestamp,
      children: [],
    }
    created = true
    return { threads: [thread, ...index.threads] }
  })

  if (!thread) throw new Error(`Failed to create thread: ${threadId}`)
  return { result: thread, events: created ? [{ type: 'created', thread }] : [] }
}

export async function executeDelete(
  storage,
  messages,
  threadId,
) {
  await storage.update(removeThread(threadId))
  await messages.deleteData({ threadId })
  return { result: undefined, events: [{ type: 'deleted', id: threadId }] }
}

export async function executeUpdate(
  storage,
  threadId,
  patch,
) {
  let result

  await storage.update((index) => {
    const thread = findById(index.threads, threadId)
    if (!thread) throw new Error(`Thread not found: ${threadId}`)

    if (patch.pinned && parentOf(index.threads, threadId)) {
      throw new Error('Cannot pin a thread inside a folder')
    }

    result = applyPatch(patch)(thread)
    return { threads: updateById(index.threads, threadId, () => result) }
  })

  if (!result) throw new Error(`Failed to update thread: ${threadId}`)
  return { result, events: [{ type: 'updated', thread: result }] }
}

export async function executeDuplicate(
  storage,
  messages,
  threadId,
  upToMessageId,
) {
  let duplicate
  let parentFolder

  await storage.update((index) => {
    const source = findById(index.threads, threadId)
    if (!source) throw new Error(`Thread not found: ${threadId}`)

    if (source.children.length > 0) {
      throw new Error('Cannot duplicate a folder')
    }

    duplicate = createThreadEntry({
      title: `${source.title ?? 'New Chat'} (Copy)`,
      renamed: source.renamed,
      prompt: source.prompt,
      children: [],
    })

    const parent = parentOf(index.threads, threadId)

    if (parent) {
      return {
        threads: updateById(index.threads, parent.id, (folder) => {
          parentFolder = appendToFolder(folder, duplicate)
          return parentFolder
        }),
      }
    }

    return { threads: [duplicate, ...index.threads] }
  })

  if (!duplicate) throw new Error('Failed to create duplicate')

  await messages.duplicateData({ sourceId: threadId, targetId: duplicate.id, upToMessageId })

  const events = [{ type: 'created', thread: duplicate }]
  if (parentFolder) {
    events.push({ type: 'updated', thread: parentFolder })
  }

  return { result: duplicate, events }
}

// ============================================================================
// FOLDER OPERATIONS
// ============================================================================

export async function executeFolderThreads(
  storage,
  threadIds,
  name,
) {
  if (threadIds.length === 0) throw new Error('At least one thread required')

  let folder

  await storage.update((index) => {
    let remaining = index.threads
    const threads = []

    for (const id of threadIds) {
      const [thread, next] = extract(remaining, id)
      if (!thread) throw new Error(`Thread not found: ${id}`)
      threads.push(thread)
      remaining = next
    }

    const folderCount = index.threads.filter((t) => t.children.length > 0).length
    const folderName = name ?? `Folder ${folderCount + 1}`
    const renamed = name !== undefined

    folder = createThreadEntry({
      title: folderName,
      renamed,
      prompt: { type: 'none' },
      children: threads.map(unpin),
    })

    return { threads: [folder, ...remaining] }
  })

  if (!folder) throw new Error('Failed to create folder')

  return {
    result: folder,
    events: [
      ...threadIds.map((id) => ({ type: 'deleted', id })),
      { type: 'created', thread: folder },
    ],
  }
}

export async function executeMoveToFolder(
  storage,
  threadId,
  folderId,
) {
  let targetFolder
  let sourceFolder

  await storage.update((index) => {
    if (!findById(index.threads, folderId)) {
      throw new Error(`Folder not found: ${folderId}`)
    }

    const parent = parentOf(index.threads, threadId)
    const [thread, remaining] = extract(index.threads, threadId)
    if (!thread) throw new Error(`Thread not found: ${threadId}`)

    let withUpdatedSource = remaining
    if (parent) {
      sourceFolder = removeChildFromParent(parent, threadId)
      withUpdatedSource = updateById(remaining, parent.id, () => sourceFolder)
    }

    return {
      threads: updateById(withUpdatedSource, folderId, (folder) => {
        targetFolder = appendToFolder(folder, thread)
        return targetFolder
      }),
    }
  })

  if (!targetFolder) return { result: undefined, events: [] }

  const events = sourceFolder
    ? [await handleFolderAfterRemoval(storage, sourceFolder)]
    : [{ type: 'deleted', id: threadId }]

  events.push({ type: 'updated', thread: targetFolder })

  return { result: targetFolder, events }
}

export async function executeMoveToRoot(
  storage,
  threadId,
) {
  let moved
  let updatedParent

  await storage.update((index) => {
    const parent = parentOf(index.threads, threadId)
    if (!parent) return index

    const [thread, remaining] = extract(index.threads, threadId)
    if (!thread) throw new Error(`Thread not found: ${threadId}`)

    moved = thread
    updatedParent = removeChildFromParent(parent, threadId)
    const withUpdatedParent = updateById(remaining, parent.id, () => updatedParent)

    return { threads: [...withUpdatedParent, thread] }
  })

  if (!moved || !updatedParent) return { result: undefined, events: [] }

  const events = [
    await handleFolderAfterRemoval(storage, updatedParent),
    { type: 'created', thread: moved },
  ]

  return { result: moved, events }
}

export async function executeReorderInFolder(
  storage,
  folderId,
  orderedIds,
) {
  let updatedFolder

  await storage.update((index) => {
    const folder = findById(index.threads, folderId)
    if (!folder) throw new Error(`Folder not found: ${folderId}`)

    const childMap = new Map(folder.children.map((c) => [c.id, c]))
    const reordered = orderedIds.map((id) => {
      const child = childMap.get(id)
      if (!child) throw new Error(`Thread ${id} not in folder ${folderId}`)
      return child
    })

    const reorder = (t) => {
      updatedFolder = { ...t, children: reordered, updatedAt: now() }
      return updatedFolder
    }

    return { threads: updateById(index.threads, folderId, reorder) }
  })

  if (!updatedFolder) return { result: undefined, events: [] }

  return { result: updatedFolder, events: [{ type: 'updated', thread: updatedFolder }] }
}
