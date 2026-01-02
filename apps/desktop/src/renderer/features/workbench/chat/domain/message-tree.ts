import type { Message } from '@arc-types/messages'
import type { BranchInfo } from '@arc-types/arc-api'
import type { BranchSelections, TreeResolution, DisplayMessage } from './types'

/**
 * Build a map from parentId to child messages, sorted by createdAt
 */
export function buildChildrenMap(messages: Message[]): Map<string | null, Message[]> {
  const map = new Map<string | null, Message[]>()

  for (const msg of messages) {
    const parentId = msg.parentId ?? null
    if (!map.has(parentId)) {
      map.set(parentId, [])
    }
    map.get(parentId)!.push(msg)
  }

  // Sort children by createdAt
  for (const children of map.values()) {
    children.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  }

  return map
}

/**
 * Resolve the display path through the message tree based on branch selections.
 *
 * Walks from root following the selected branch at each branch point.
 * Returns both the path (messages to display) and branch points (for UI navigation).
 */
export function resolveTree(messages: Message[], selections: BranchSelections): TreeResolution {
  if (messages.length === 0) {
    return { path: [], branchPoints: [] }
  }

  const childrenMap = buildChildrenMap(messages)
  const path: Message[] = []
  const branchPoints: BranchInfo[] = []
  let currentParentId: string | null = null

  while (true) {
    const children = childrenMap.get(currentParentId)
    if (!children || children.length === 0) break

    if (children.length > 1) {
      // Branch point: select based on saved selection or default to latest
      const selectionKey = currentParentId ?? 'root'
      const selectedIndex = selections[selectionKey] ?? (children.length - 1)
      const clampedIndex = Math.min(selectedIndex, children.length - 1)

      branchPoints.push({
        parentId: currentParentId,
        branches: children.map((c) => c.id),
        currentIndex: clampedIndex,
      })

      path.push(children[clampedIndex])
      currentParentId = children[clampedIndex].id
    } else {
      path.push(children[0])
      currentParentId = children[0].id
    }
  }

  return { path, branchPoints }
}

/**
 * Find children of a given parent in the message list
 */
export function findChildren(messages: Message[], parentId: string | null): Message[] {
  return messages
    .filter((m) => m.parentId === parentId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}

/**
 * Find the parent of a message by its position in the list
 */
export function findEditParent(messages: Message[], messageId: string): string | null {
  const index = messages.findIndex((m) => m.id === messageId)
  return index > 0 ? messages[index - 1].id : null
}

/**
 * Compose display-ready messages with UI state flags
 */
export function composeDisplayMessages(
  base: Message[],
  streamingMessage: Message | null,
  editingId: string | null,
): DisplayMessage[] {
  const result: DisplayMessage[] = base.map((m) => ({
    ...m,
    isStreaming: false,
    isEditing: m.id === editingId,
  }))
  if (streamingMessage) {
    result.push({ ...streamingMessage, isStreaming: true, isEditing: false })
  }
  return result
}
