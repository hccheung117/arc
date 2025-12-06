/**
 * Storage Registry
 *
 * Centralized abstraction for the application's persistence layer.
 * Maps logical resources (Settings, Thread Index, Message Logs) to physical storage
 * using the ArcFS foundation (JsonFile and JsonLog).
 *
 * Philosophy:
 * - Application code interacts with logical resources, not file paths
 * - Storage strategy (Atomic vs Append) is intrinsic to the resource type
 * - Format abstraction: Business logic is agnostic to JSON vs JSONL
 */

import { app } from 'electron'
import * as path from 'path'
import type { z } from 'zod'
import { JsonFile } from './arcfs/json-file'
import { JsonLog } from './arcfs/json-log'
import {
  StoredFavoriteSchema,
  StoredSettingsSchema,
  StoredModelFilterSchema,
  StoredProviderSchema,
  StoredModelCacheSchema,
  StoredModelSchema,
  StoredThreadIndexSchema,
  StoredThreadSchema,
  StoredAttachmentSchema,
  StoredMessageEventSchema,
  StoredThreadMetaEventSchema,
  ThreadEventSchema,
  BranchInfoSchema,
} from './storage.schema'

// ============================================================================
// TYPE EXPORTS (derived from Zod schemas)
// ============================================================================

export type StoredFavorite = z.infer<typeof StoredFavoriteSchema>
export type StoredSettings = z.infer<typeof StoredSettingsSchema>
export type StoredModelFilter = z.infer<typeof StoredModelFilterSchema>
export type StoredProvider = z.infer<typeof StoredProviderSchema>
export type StoredModelCache = z.infer<typeof StoredModelCacheSchema>
export type StoredModel = z.infer<typeof StoredModelSchema>
export type StoredThreadIndex = z.infer<typeof StoredThreadIndexSchema>
export type StoredThread = z.infer<typeof StoredThreadSchema>
export type StoredAttachment = z.infer<typeof StoredAttachmentSchema>
export type StoredMessageEvent = z.infer<typeof StoredMessageEventSchema>
export type StoredThreadMetaEvent = z.infer<typeof StoredThreadMetaEventSchema>
export type ThreadEvent = z.infer<typeof ThreadEventSchema>
export type BranchInfo = z.infer<typeof BranchInfoSchema>

// ============================================================================
// PATH MANAGEMENT
// ============================================================================

/**
 * Returns the root data directory path.
 * Platform-specific via Electron's app.getPath('userData').
 *
 * Example (macOS): ~/Library/Application Support/arc/arcfs/
 */
function getDataDir(): string {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, 'arcfs')
}

/**
 * Path to the messages directory (contains index + logs).
 * Exported for use by attachments module.
 */
export function getMessagesDir(): string {
  return path.join(getDataDir(), 'messages')
}

// ============================================================================
// STORAGE FACTORY FUNCTIONS
// ============================================================================

/**
 * Returns a JsonFile engine for the settings.json file.
 *
 * Default: Empty providers array.
 * Format: Standard JSON Object.
 * Safety: Atomic write via write-file-atomic + Zod validation.
 */
export function settingsFile(): JsonFile<StoredSettings> {
  const filePath = path.join(getDataDir(), 'settings.json')
  const defaultValue: StoredSettings = { activeProfileId: null, favorites: [] }
  return new JsonFile(filePath, defaultValue, StoredSettingsSchema)
}

/**
 * Returns a JsonFile engine for the models.cache.json file.
 *
 * Default: Empty models array.
 * Format: Standard JSON Object.
 * Safety: Atomic write via write-file-atomic + Zod validation.
 * Lifecycle: Transient, can be regenerated.
 */
export function modelsFile(): JsonFile<StoredModelCache> {
  const filePath = path.join(getDataDir(), 'models.cache.json')
  const defaultValue: StoredModelCache = { models: [] }
  return new JsonFile(filePath, defaultValue, StoredModelCacheSchema)
}

/**
 * Returns a JsonFile engine for the thread index (messages/index.json).
 *
 * Default: Empty threads array.
 * Format: Standard JSON Object.
 * Safety: Atomic write via write-file-atomic + Zod validation.
 * Access: Read-heavy (app startup), Write-occasional (rename/pin/etc).
 */
export function threadIndexFile(): JsonFile<StoredThreadIndex> {
  const filePath = path.join(getMessagesDir(), 'index.json')
  const defaultValue: StoredThreadIndex = { threads: [] }
  return new JsonFile(filePath, defaultValue, StoredThreadIndexSchema)
}

/**
 * Returns a JsonLog engine for a specific thread's message history.
 *
 * Format: JSON Lines (JSONL) - one event per line.
 * Safety: Append-only, crash-proof + Zod validation per line.
 * Access: Write-frequent (streaming), Read-lazy (on thread open).
 *
 * @param threadId - The thread ID (cuid2)
 */
export function messageLogFile(threadId: string): JsonLog<ThreadEvent> {
  const filePath = path.join(getMessagesDir(), `${threadId}.jsonl`)
  return new JsonLog(filePath, ThreadEventSchema)
}

// ============================================================================
// UTILITY: EVENT SOURCING REDUCER
// ============================================================================

/**
 * Type guard to distinguish message events from meta events.
 */
function isMessageEvent(event: ThreadEvent): event is StoredMessageEvent {
  return !('type' in event)
}

/**
 * Result of reducing thread events with branching support.
 */
export interface ReduceResult {
  messages: StoredMessageEvent[] // Messages along the active path
  branchPoints: BranchInfo[] // Points where conversation diverges
}

/**
 * Reduces thread events into the active message path and branch information.
 *
 * Strategy:
 * 1. Merge message events by ID (existing behavior)
 * 2. Build a tree using parentId relationships
 * 3. Extract the active path from the latest meta event (or default to first branch)
 * 4. Compute branch points for UI navigation
 *
 * @param events - Array of thread events from the log file
 * @returns Messages along active path + branch point information
 */
export function reduceMessageEvents(events: ThreadEvent[]): ReduceResult {
  // Separate message events from meta events
  const messageEvents = events.filter(isMessageEvent)
  const metaEvents = events.filter((e): e is StoredThreadMetaEvent => !isMessageEvent(e))

  // Merge message events by ID
  const messagesById = new Map<string, StoredMessageEvent>()
  for (const event of messageEvents) {
    const existing = messagesById.get(event.id)
    if (existing) {
      messagesById.set(event.id, { ...existing, ...event })
    } else {
      messagesById.set(event.id, { ...event })
    }
  }

  // Filter deleted messages
  const validMessages = Array.from(messagesById.values()).filter((msg) => !msg.deleted)

  // Build children map: parentId -> child messages (sorted by createdAt)
  const childrenMap = new Map<string | null, StoredMessageEvent[]>()
  for (const msg of validMessages) {
    const parentId = msg.parentId
    if (!childrenMap.has(parentId)) {
      childrenMap.set(parentId, [])
    }
    childrenMap.get(parentId)!.push(msg)
  }

  // Sort children by createdAt at each level
  for (const children of childrenMap.values()) {
    children.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return timeA - timeB
    })
  }

  // Get active path from latest meta event, or compute default (follow first child)
  // Then extend to leaf to include messages added after the meta event was created
  const latestMeta = metaEvents.length > 0 ? metaEvents[metaEvents.length - 1] : null
  let activePath: string[]
  if (latestMeta?.activePath && latestMeta.activePath.length > 0) {
    activePath = extendPathToLeaf(latestMeta.activePath, childrenMap)
  } else {
    activePath = computeDefaultPath(childrenMap)
  }

  // Extract messages along active path
  const activeMessages = activePath
    .map((id) => messagesById.get(id))
    .filter((m): m is StoredMessageEvent => m !== undefined && !m.deleted)

  // Compute branch points for UI
  const branchPoints = computeBranchPoints(activePath, childrenMap)

  return { messages: activeMessages, branchPoints }
}

/**
 * Computes the default path by following the first (oldest) child at each level.
 */
function computeDefaultPath(
  childrenMap: Map<string | null, StoredMessageEvent[]>,
): string[] {
  const path: string[] = []
  let currentParent: string | null = null

  while (true) {
    const children = childrenMap.get(currentParent)
    if (!children || children.length === 0) break

    const next = children[0] // Take oldest child
    path.push(next.id)
    currentParent = next.id
  }

  return path
}

/**
 * Extends a stored path to the leaf by following the first (oldest) child at each level.
 * This ensures new messages added after a branch switch are included in the active path.
 */
function extendPathToLeaf(
  storedPath: string[],
  childrenMap: Map<string | null, StoredMessageEvent[]>,
): string[] {
  const path = [...storedPath]
  let currentParent = path[path.length - 1]

  while (true) {
    const children = childrenMap.get(currentParent)
    if (!children || children.length === 0) break

    const next = children[0] // Follow oldest child
    path.push(next.id)
    currentParent = next.id
  }

  return path
}

/**
 * Computes branch points along the active path.
 * A branch point exists where a message has multiple children.
 */
function computeBranchPoints(
  activePath: string[],
  childrenMap: Map<string | null, StoredMessageEvent[]>,
): BranchInfo[] {
  const branchPoints: BranchInfo[] = []

  // Check root level (null parent)
  const rootChildren = childrenMap.get(null) ?? []
  if (rootChildren.length > 1) {
    branchPoints.push({
      parentId: null,
      branches: rootChildren.map((c) => c.id),
      currentIndex: rootChildren.findIndex((c) => c.id === activePath[0]),
    })
  }

  // Check each message in active path for multiple children
  for (const msgId of activePath) {
    const children = childrenMap.get(msgId) ?? []
    if (children.length > 1) {
      const activeChildId = activePath[activePath.indexOf(msgId) + 1]
      branchPoints.push({
        parentId: msgId,
        branches: children.map((c) => c.id),
        currentIndex: children.findIndex((c) => c.id === activeChildId),
      })
    }
  }

  return branchPoints
}
