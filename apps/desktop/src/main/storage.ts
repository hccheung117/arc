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
import { JsonFile } from './arcfs/json-file'
import { JsonLog } from './arcfs/json-log'

// ============================================================================
// ON-DISK SCHEMAS
// ============================================================================

/**
 * Settings Schema (Config Archetype)
 *
 * Stores user-configured AI providers and preferences.
 * Written atomically via JsonFile.
 *
 * Location: data/settings.json
 */
export interface StoredSettings {
  providers: StoredProvider[]
  favorites?: string[]
}

export interface StoredProvider {
  id: string // cuid2
  name: string
  type: string // 'openai' | 'anthropic' | 'ollama' etc.
  apiKey: string | null // Encrypted using safeStorage
  baseUrl: string | null
}

/**
 * Models Cache Schema (Config Archetype - Transient)
 *
 * Stores the latest list of available models fetched from providers.
 * Can be regenerated; safe to delete.
 *
 * Location: data/models.cache.json
 */
export interface StoredModelCache {
  models: StoredModel[]
}

export interface StoredModel {
  id: string // Model ID from provider (e.g., 'gpt-4o')
  providerId: string // cuid2 reference to StoredProvider
  name: string // Display name
  contextWindow?: number
  fetchedAt: string // ISO timestamp
}

/**
 * Thread Index Schema (Ledger Archetype)
 *
 * High-level metadata for all threads to power Sidebar and navigation.
 * Loaded entirely into memory on startup for instant UI rendering.
 *
 * Location: data/messages/index.json
 */
export interface StoredThreadIndex {
  threads: StoredThread[]
}

export interface StoredThread {
  id: string // cuid2
  title: string | null // User-set title, or null for auto-generated
  pinned: boolean
  renamed: boolean // Whether user has manually renamed this thread
  createdAt: string // ISO timestamp
  updatedAt: string // ISO timestamp
}

/**
 * Message Event Schema (Stream Archetype)
 *
 * Event sourcing log for a single thread.
 * Append-only for crash safety and zero data loss.
 *
 * ATOMIC WRITE POLICY FOR AI RESPONSES:
 * ------------------------------------
 * AI assistant messages are written as a single, complete line containing both
 * `reasoning` and `content`. We intentionally avoid incremental writes during
 * streaming to ensure crash safety:
 *
 * - If the app crashes during AI generation, nothing is persisted (clean slate)
 * - User reopens and sees their last message with no AI response → clear "retry" state
 * - No "zombie" messages with reasoning but no content
 *
 * The reducer supports merging multiple events with the same ID for future
 * extensibility (e.g., message edits), but AI streaming does NOT use this pattern.
 *
 * Location: data/messages/{threadId}.jsonl
 */
/** Stored attachment reference (path only, no data URL) */
export interface StoredAttachment {
  type: 'image'
  path: string // Relative path: {messageId}-{index}.{ext}
  mimeType: string
}

export interface StoredMessageEvent {
  id: string // cuid2 - Message ID
  role?: 'user' | 'assistant' | 'system' // Required for 'create' events
  content?: string // Message content (can be updated)
  reasoning?: string // Reasoning/thinking content from AI models
  createdAt?: string // ISO timestamp (only on 'create' events)
  updatedAt?: string // ISO timestamp (on 'update' events)
  deleted?: boolean // Marks message as soft-deleted

  // Tree structure for branching
  parentId: string | null // null for root message, parent message ID otherwise

  // Attachments (user messages with images)
  attachments?: StoredAttachment[]

  // Model context (required on all messages)
  modelId: string // Model ID when message was sent/generated
  providerId: string // Provider ID when message was sent/generated

  // AI SDK usage (assistant messages only) - stored as-is from SDK
  usage?: {
    inputTokens?: number
    outputTokens?: number
    totalTokens?: number
    reasoningTokens?: number
    cachedInputTokens?: number
  }
}

/**
 * Thread Metadata Event (Stream Archetype)
 *
 * Tracks the active path through the message tree for branching support.
 * Stored in the same JSONL file as message events.
 */
export interface StoredThreadMetaEvent {
  type: 'thread_meta'
  activePath: string[] // Ordered message IDs representing current view
  updatedAt: string // ISO timestamp
}

/**
 * Union type for all events in a thread log.
 */
export type ThreadEvent = StoredMessageEvent | StoredThreadMetaEvent

/**
 * Branch information for UI navigation.
 * Describes a point where the conversation diverges.
 */
export interface BranchInfo {
  parentId: string | null // The message where branching occurs (null for root)
  branches: string[] // Message IDs of the first message in each branch
  currentIndex: number // Which branch is currently active (0-indexed)
}

// ============================================================================
// PATH MANAGEMENT
// ============================================================================

/**
 * Returns the root data directory path.
 * Platform-specific via Electron's app.getPath('userData').
 *
 * Example (macOS): ~/Library/Application Support/arc/data/
 */
function getDataDir(): string {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, 'data')
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
 * Safety: Atomic write via write-file-atomic.
 */
export function settingsFile(): JsonFile<StoredSettings> {
  const filePath = path.join(getDataDir(), 'settings.json')
  const defaultValue: StoredSettings = { providers: [], favorites: [] }
  return new JsonFile(filePath, defaultValue)
}

/**
 * Returns a JsonFile engine for the models.cache.json file.
 *
 * Default: Empty models array.
 * Format: Standard JSON Object.
 * Safety: Atomic write via write-file-atomic.
 * Lifecycle: Transient, can be regenerated.
 */
export function modelsFile(): JsonFile<StoredModelCache> {
  const filePath = path.join(getDataDir(), 'models.cache.json')
  const defaultValue: StoredModelCache = { models: [] }
  return new JsonFile(filePath, defaultValue)
}

/**
 * Returns a JsonFile engine for the thread index (messages/index.json).
 *
 * Default: Empty threads array.
 * Format: Standard JSON Object.
 * Safety: Atomic write via write-file-atomic.
 * Access: Read-heavy (app startup), Write-occasional (rename/pin/etc).
 */
export function threadIndexFile(): JsonFile<StoredThreadIndex> {
  const filePath = path.join(getMessagesDir(), 'index.json')
  const defaultValue: StoredThreadIndex = { threads: [] }
  return new JsonFile(filePath, defaultValue)
}

/**
 * Returns a JsonLog engine for a specific thread's message history.
 *
 * Format: JSON Lines (JSONL) - one event per line.
 * Safety: Append-only, crash-proof.
 * Access: Write-frequent (streaming), Read-lazy (on thread open).
 *
 * @param threadId - The thread ID (cuid2)
 */
export function messageLogFile(threadId: string): JsonLog<ThreadEvent> {
  const filePath = path.join(getMessagesDir(), `${threadId}.jsonl`)
  return new JsonLog(filePath)
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
