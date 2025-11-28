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
 * Multiple events can share the same `id` (create + update).
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
  createdAt?: string // ISO timestamp (only on 'create' events)
  updatedAt?: string // ISO timestamp (on 'update' events)

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
  const defaultValue: StoredSettings = { providers: [] }
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
export function messageLogFile(threadId: string): JsonLog<StoredMessageEvent> {
  const filePath = path.join(getMessagesDir(), `${threadId}.jsonl`)
  return new JsonLog(filePath)
}

// ============================================================================
// UTILITY: EVENT SOURCING REDUCER
// ============================================================================

/**
 * Reduces a sequence of message events into the final message state.
 *
 * Strategy: Merge events by ID, with later events overwriting earlier fields.
 * This implements event sourcing: the log is the source of truth, and we
 * reconstruct the current state by replaying all events.
 *
 * Example:
 * Input:  [
 *   { id: 'm1', role: 'user', content: 'Hi', createdAt: '...' },
 *   { id: 'm2', role: 'assistant', content: 'Hello', createdAt: '...' },
 *   { id: 'm2', usage: 100, modelId: 'gpt-4' },
 *   { id: 'm1', content: 'Hi there', updatedAt: '...' }
 * ]
 * Output: [
 *   { id: 'm1', role: 'user', content: 'Hi there', createdAt: '...', updatedAt: '...' },
 *   { id: 'm2', role: 'assistant', content: 'Hello', usage: 100, modelId: 'gpt-4', createdAt: '...' }
 * ]
 *
 * @param events - Array of message events from the log file
 * @returns Array of merged message objects, ordered by creation time
 */
export function reduceMessageEvents(events: StoredMessageEvent[]): StoredMessageEvent[] {
  const messagesById = new Map<string, StoredMessageEvent>()

  // Merge events by ID
  for (const event of events) {
    const existing = messagesById.get(event.id)
    if (existing) {
      // Later event overwrites fields from earlier event
      messagesById.set(event.id, { ...existing, ...event })
    } else {
      messagesById.set(event.id, { ...event })
    }
  }

  // Convert to array and sort by creation time
  const messages = Array.from(messagesById.values())
  messages.sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0
    return timeA - timeB
  })

  return messages
}
