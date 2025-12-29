/**
 * Message Domain Storage
 *
 * Two storage archetypes optimized for different access patterns:
 *
 * Thread Index (Ledger archetype):
 * - High-value metadata loaded at startup
 * - Atomic writes guarantee consistency
 * - Optimized for read speed
 *
 * Message Logs (Stream archetype):
 * - High-volume, chronological, append-only content
 * - New data appends to end of log—history intact even during crashes
 * - Loaded lazily when thread opens
 */

import { JsonFile } from '@main/foundation/json-file'
import { JsonLog } from '@main/foundation/json-log'
import { getThreadIndexPath, getMessageLogPath } from '@main/lib/arcfs/paths'
import {
  StoredThreadIndexSchema,
  StoredMessageEventSchema,
  type StoredThreadIndex,
  type StoredMessageEvent,
} from './schemas'

// Re-export path utilities needed by operations
export { getThreadAttachmentsDir, getThreadAttachmentPath } from '@main/lib/arcfs/paths'

/**
 * Returns a JsonFile engine for the thread index (messages/index.json).
 *
 * Default: Empty threads array.
 * Format: Standard JSON Object.
 * Safety: Atomic write via write-file-atomic + Zod validation.
 * Access: Read-heavy (app startup), Write-occasional (rename/pin/etc).
 */
export function threadIndexFile(): JsonFile<StoredThreadIndex> {
  const defaultValue: StoredThreadIndex = { threads: [] }
  return new JsonFile(getThreadIndexPath(), defaultValue, StoredThreadIndexSchema)
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
  return new JsonLog(getMessageLogPath(threadId), StoredMessageEventSchema)
}
