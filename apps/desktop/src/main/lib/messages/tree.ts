/**
 * Tree Primitives for StoredThread Hierarchy
 *
 * Single source of truth for recursive tree traversal.
 * All thread/folder operations that need to search or update
 * nested structures should use these helpers.
 */

import type { StoredThread } from '@boundary/messages'

/** Finds first thread matching predicate, depth-first */
export function find(tree: StoredThread[], p: (t: StoredThread) => boolean): StoredThread | undefined {
  for (const t of tree) {
    if (p(t)) return t
    const found = find(t.children, p)
    if (found) return found
  }
}

/** Finds thread by id anywhere in tree */
export function findById(tree: StoredThread[], id: string): StoredThread | undefined {
  return find(tree, (t) => t.id === id)
}

/** Finds parent of a thread by child id */
export function parentOf(tree: StoredThread[], childId: string): StoredThread | undefined {
  for (const t of tree) {
    if (t.children.some((c) => c.id === childId)) return t
    const found = parentOf(t.children, childId)
    if (found) return found
  }
}

/** Updates a thread by id immutably, returning new tree */
export function updateById(
  tree: StoredThread[],
  id: string,
  fn: (t: StoredThread) => StoredThread,
): StoredThread[] {
  return tree.map((t) =>
    t.id === id ? fn(t) : { ...t, children: updateById(t.children, id, fn) },
  )
}

/** Extracts a thread from tree, returns [extracted, remaining] */
export function extract(tree: StoredThread[], id: string): [StoredThread | undefined, StoredThread[]] {
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
