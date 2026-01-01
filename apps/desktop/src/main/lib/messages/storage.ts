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
 *
 * Attachments:
 * - Binary files stored in thread-specific directories
 * - Referenced by relative path in message events
 */

import * as fs from 'fs/promises'
import { JsonFile } from '@main/foundation/json-file'
import { JsonLog } from '@main/foundation/json-log'
import {
  getThreadIndexPath,
  getMessageLogPath,
  getThreadAttachmentsDir,
  getThreadAttachmentPath,
} from '@main/lib/arcfs/paths'
import {
  StoredThreadIndexSchema,
  StoredMessageEventSchema,
  type StoredThreadIndex,
  type StoredMessageEvent,
  type StoredAttachment,
} from './schemas'

// ============================================================================
// FILE ENGINES
// ============================================================================

/**
 * Returns a JsonFile engine for the thread index (messages/index.json).
 */
export function threadIndexFile(): JsonFile<StoredThreadIndex> {
  const defaultValue: StoredThreadIndex = { threads: [] }
  return new JsonFile(getThreadIndexPath(), defaultValue, StoredThreadIndexSchema)
}

/**
 * Returns a JsonLog engine for a specific thread's message history.
 *
 * @param threadId - The thread ID (cuid2)
 */
export function messageLogFile(threadId: string): JsonLog<StoredMessageEvent> {
  return new JsonLog(getMessageLogPath(threadId), StoredMessageEventSchema)
}

// ============================================================================
// ATTACHMENT I/O
// ============================================================================

/**
 * Maps MIME type to file extension.
 */
function getExtension(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
  }
  return mimeToExt[mimeType] || 'png'
}

/**
 * Ensures the thread's attachment directory exists.
 */
async function ensureAttachmentsDir(threadId: string): Promise<void> {
  await fs.mkdir(getThreadAttachmentsDir(threadId), { recursive: true })
}

/**
 * Writes an attachment to disk.
 *
 * @param threadId - The thread ID
 * @param messageId - The message ID (used in filename)
 * @param index - Attachment index within message
 * @param data - Base64-encoded file data
 * @param mimeType - MIME type of the file
 * @returns StoredAttachment with relative path
 */
export async function writeAttachment(
  threadId: string,
  messageId: string,
  index: number,
  data: string,
  mimeType: string,
): Promise<StoredAttachment> {
  await ensureAttachmentsDir(threadId)

  const ext = getExtension(mimeType)
  const filename = `${messageId}-${index}.${ext}`
  const absolutePath = getThreadAttachmentPath(threadId, filename)

  const buffer = Buffer.from(data, 'base64')
  await fs.writeFile(absolutePath, buffer)

  return {
    type: 'image',
    path: filename,
    mimeType,
  }
}

/**
 * Deletes all attachments for a thread.
 *
 * @param threadId - The thread ID
 */
export async function deleteThreadAttachments(threadId: string): Promise<void> {
  try {
    await fs.rm(getThreadAttachmentsDir(threadId), { recursive: true, force: true })
  } catch {
    // Directory may not exist
  }
}
