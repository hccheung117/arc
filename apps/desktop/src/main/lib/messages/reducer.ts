/**
 * Message Event Reducer
 *
 * Event sourcing logic for message persistence:
 * - Merges message events by ID
 * - Filters deleted messages
 * - Builds tree structure via parentId
 * - Computes branch points
 */

import type { StoredMessageEvent, BranchInfo } from './schemas'

/**
 * Result of reducing message events with branching support.
 */
export interface ReduceResult {
  messages: StoredMessageEvent[] // All valid messages (tree structure via parentId)
  branchPoints: BranchInfo[] // All points where conversation diverges
}

/**
 * Reduces message events into a flat list with branch information.
 *
 * Strategy:
 * 1. Merge message events by ID (handle updates)
 * 2. Build a tree using parentId relationships
 * 3. Return all valid messages (renderer handles path selection)
 * 4. Compute all branch points in the tree
 *
 * @param events - Array of message events from the log file
 * @returns All messages + all branch points in tree
 */
export function reduceMessageEvents(events: StoredMessageEvent[]): ReduceResult {
  // Merge message events by ID
  const messagesById = new Map<string, StoredMessageEvent>()
  for (const event of events) {
    const existing = messagesById.get(event.id)
    if (existing) {
      messagesById.set(event.id, { ...existing, ...event })
    } else {
      messagesById.set(event.id, { ...event })
    }
  }

  // Filter deleted messages
  const validMessages = Array.from(messagesById.values()).filter((msg) => !msg.deleted)

  // Build children map: parentId -> child message IDs (sorted by createdAt)
  const childrenMap = new Map<string | null, string[]>()
  for (const msg of validMessages) {
    // Normalize undefined to null for consistent map keys
    const parentId = msg.parentId ?? null
    if (!childrenMap.has(parentId)) {
      childrenMap.set(parentId, [])
    }
    childrenMap.get(parentId)!.push(msg.id)
  }

  // Sort children by createdAt at each level
  for (const [parentId, childIds] of childrenMap.entries()) {
    childIds.sort((a, b) => {
      const msgA = messagesById.get(a)
      const msgB = messagesById.get(b)
      const timeA = msgA?.createdAt ? new Date(msgA.createdAt).getTime() : 0
      const timeB = msgB?.createdAt ? new Date(msgB.createdAt).getTime() : 0
      return timeA - timeB
    })
    childrenMap.set(parentId, childIds)
  }

  // Compute all branch points in the tree (any parent with multiple children)
  const branchPoints = computeAllBranchPoints(childrenMap)

  return { messages: validMessages, branchPoints }
}

/**
 * Computes all branch points in the tree.
 * A branch point exists where a parent has multiple children.
 * Note: currentIndex is set to 0 (default) - renderer manages active selection.
 */
function computeAllBranchPoints(
  childrenMap: Map<string | null, string[]>,
): BranchInfo[] {
  const branchPoints: BranchInfo[] = []

  for (const [parentId, children] of childrenMap.entries()) {
    if (children.length > 1) {
      branchPoints.push({
        parentId,
        branches: children,
        currentIndex: 0, // Default to first branch; renderer manages selection
      })
    }
  }

  return branchPoints
}
