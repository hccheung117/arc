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

import { createHash } from 'crypto'
import { app } from 'electron'
import * as path from 'path'
import { z } from 'zod'
import type { ArcFileProvider } from '@arc-types/arc-file'
import { JsonFile } from '../arcfs/json-file'
import { JsonLog } from '../arcfs/json-log'

// ============================================================================
// SETTINGS SCHEMAS
// ============================================================================

export const StoredFavoriteSchema = z.object({
  providerId: z.string(),
  modelId: z.string(),
})
export type StoredFavorite = z.infer<typeof StoredFavoriteSchema>

export const StoredSettingsSchema = z.object({
  activeProfileId: z.string().nullable(),
  favorites: z.array(StoredFavoriteSchema),
})
export type StoredSettings = z.infer<typeof StoredSettingsSchema>

export const StoredModelFilterSchema = z.object({
  mode: z.enum(['allow', 'deny']),
  rules: z.array(z.string()),
})
export type StoredModelFilter = z.infer<typeof StoredModelFilterSchema>

export const StoredProviderSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  apiKey: z.string().nullable(),
  baseUrl: z.string().nullable(),
  modelFilter: StoredModelFilterSchema.optional(),
})
export type StoredProvider = z.infer<typeof StoredProviderSchema>

// ============================================================================
// MODELS CACHE SCHEMAS
// ============================================================================

export const StoredModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  providerId: z.string(),
  providerName: z.string(),
  providerType: z.literal('openai'),
  contextWindow: z.number().optional(),
  fetchedAt: z.string(),
})
export type StoredModel = z.infer<typeof StoredModelSchema>

export const StoredModelCacheSchema = z.object({
  models: z.array(StoredModelSchema),
})
export type StoredModelCache = z.infer<typeof StoredModelCacheSchema>

// ============================================================================
// THREAD INDEX SCHEMAS
// ============================================================================

export const StoredThreadSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  pinned: z.boolean(),
  renamed: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type StoredThread = z.infer<typeof StoredThreadSchema>

export const StoredThreadIndexSchema = z.object({
  threads: z.array(StoredThreadSchema),
})
export type StoredThreadIndex = z.infer<typeof StoredThreadIndexSchema>

// ============================================================================
// MESSAGE EVENT SCHEMAS
// ============================================================================

export const StoredAttachmentSchema = z.object({
  type: z.literal('image'),
  path: z.string(),
  mimeType: z.string(),
})
export type StoredAttachment = z.infer<typeof StoredAttachmentSchema>

export const UsageSchema = z.object({
  inputTokens: z.number().optional(),
  outputTokens: z.number().optional(),
  totalTokens: z.number().optional(),
  reasoningTokens: z.number().optional(),
  cachedInputTokens: z.number().optional(),
})
export type Usage = z.infer<typeof UsageSchema>

export const StoredMessageEventSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant', 'system']).optional(),
  content: z.string().optional(),
  reasoning: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  deleted: z.boolean().optional(),
  // Optional for partial update events (event sourcing merges by ID)
  parentId: z.string().nullable().optional(),
  attachments: z.array(StoredAttachmentSchema).optional(),
  modelId: z.string().optional(),
  providerId: z.string().optional(),
  usage: UsageSchema.optional(),
})
export type StoredMessageEvent = z.infer<typeof StoredMessageEventSchema>


// ============================================================================
// BRANCH INFO SCHEMAS
// ============================================================================

export const BranchInfoSchema = z.object({
  parentId: z.string().nullable(),
  branches: z.array(z.string()),
  currentIndex: z.number(),
})
export type BranchInfo = z.infer<typeof BranchInfoSchema>

export const ReduceResultSchema = z.object({
  messages: z.array(StoredMessageEventSchema),
  branchPoints: z.array(BranchInfoSchema),
})

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
 */
export function getMessagesDir(): string {
  return path.join(getDataDir(), 'messages')
}

/**
 * Returns the absolute file path for an attachment.
 */
export function getAttachmentPath(threadId: string, relativePath: string): string {
  return path.join(getMessagesDir(), threadId, relativePath)
}

/**
 * Generates a stable provider ID from provider properties.
 * SHA-256 hash of type|apiKey|baseUrl ensures same config = same ID.
 */
export function generateProviderId(provider: ArcFileProvider): string {
  const input = `${provider.type}|${provider.apiKey ?? ''}|${provider.baseUrl ?? ''}`
  return createHash('sha256').update(input).digest('hex').slice(0, 8)
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
export function messageLogFile(threadId: string): JsonLog<StoredMessageEvent> {
  const filePath = path.join(getMessagesDir(), `${threadId}.jsonl`)
  return new JsonLog(filePath, StoredMessageEventSchema)
}

// ============================================================================
// UTILITY: EVENT SOURCING REDUCER
// ============================================================================

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
