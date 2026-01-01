/**
 * Message Event Reducer
 *
 * Event sourcing logic for message persistence:
 * - Merges message events by ID
 * - Filters deleted messages
 * - Builds tree structure via parentId
 */

import type { StoredMessageEvent, BranchInfo } from './schemas'
import { computeBranchPoints } from './branching'

/**
 * Result of reducing message events with branching support.
 */
export interface ReduceResult {
  messages: StoredMessageEvent[]
  branchPoints: BranchInfo[]
}

/**
 * Reduces message events into a flat list with branch information.
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
    const parentId = msg.parentId ?? null
    if (!childrenMap.has(parentId)) {
      childrenMap.set(parentId, [])
    }
    childrenMap.get(parentId)!.push(msg.id)
  }

  // Sort children by createdAt at each level
  for (const [, childIds] of childrenMap.entries()) {
    childIds.sort((a, b) => {
      const msgA = messagesById.get(a)
      const msgB = messagesById.get(b)
      const timeA = msgA?.createdAt ? new Date(msgA.createdAt).getTime() : 0
      const timeB = msgB?.createdAt ? new Date(msgB.createdAt).getTime() : 0
      return timeA - timeB
    })
  }

  const branchPoints = computeBranchPoints(childrenMap)

  return { messages: validMessages, branchPoints }
}
