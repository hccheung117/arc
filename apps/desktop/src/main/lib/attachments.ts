/**
 * Attachment File I/O Utilities
 *
 * Handles reading and writing image attachments to disk.
 * Images are stored in per-thread directories alongside the message log.
 *
 * Storage layout:
 * userData/arcfs/messages/
 * ├── {threadId}.jsonl          # Message log
 * ├── {threadId}/               # Attachments folder
 * │   ├── {messageId}-0.png     # Naming: ID + Index
 * │   └── {messageId}-1.jpg
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import { getMessagesDir, type StoredAttachment } from '@main/storage'

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
 * Returns the absolute path to a thread's attachment directory.
 */
function getThreadAttachmentsDir(threadId: string): string {
  return path.join(getMessagesDir(), threadId)
}

/**
 * Ensures the thread's attachment directory exists.
 */
async function ensureAttachmentsDir(threadId: string): Promise<void> {
  const dir = getThreadAttachmentsDir(threadId)
  await fs.mkdir(dir, { recursive: true })
}

/**
 * Writes an attachment to disk.
 *
 * @param threadId - The thread ID
 * @param messageId - The message ID
 * @param index - Attachment index within the message
 * @param data - Base64-encoded image data
 * @param mimeType - MIME type of the image
 * @returns The relative path (for storage in the message log)
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
  const relativePath = filename
  const absolutePath = path.join(getThreadAttachmentsDir(threadId), filename)

  // Decode base64 and write to disk
  const buffer = Buffer.from(data, 'base64')
  await fs.writeFile(absolutePath, buffer)

  return {
    type: 'image',
    path: relativePath,
    mimeType,
  }
}

/**
 * Reads an attachment from disk and returns it as a data URL.
 *
 * @param threadId - The thread ID
 * @param relativePath - The relative path from the message log
 * @param mimeType - MIME type for the data URL
 * @returns data: URL string
 */
export async function readAttachment(
  threadId: string,
  relativePath: string,
  mimeType: string,
): Promise<string> {
  const absolutePath = path.join(getThreadAttachmentsDir(threadId), relativePath)
  const buffer = await fs.readFile(absolutePath)
  const base64 = buffer.toString('base64')
  return `data:${mimeType};base64,${base64}`
}

/**
 * Returns the absolute file path for an attachment.
 * Used for opening in native OS viewer.
 *
 * @param threadId - The thread ID
 * @param relativePath - The relative path from the message log
 * @returns Absolute file path
 */
export function getAttachmentPath(threadId: string, relativePath: string): string {
  return path.join(getThreadAttachmentsDir(threadId), relativePath)
}

/**
 * Deletes all attachments for a thread.
 *
 * @param threadId - The thread ID
 */
export async function deleteThreadAttachments(threadId: string): Promise<void> {
  const dir = getThreadAttachmentsDir(threadId)
  try {
    await fs.rm(dir, { recursive: true, force: true })
  } catch {
    // Directory may not exist, ignore
  }
}

/**
 * Deletes a single attachment file.
 * Used when truncating messages during edit operations.
 *
 * @param threadId - The thread ID
 * @param relativePath - The relative path from the message log
 */
export async function deleteAttachmentFile(
  threadId: string,
  relativePath: string,
): Promise<void> {
  const absolutePath = path.join(getThreadAttachmentsDir(threadId), relativePath)
  try {
    await fs.unlink(absolutePath)
  } catch {
    // File may not exist, ignore
  }
}
