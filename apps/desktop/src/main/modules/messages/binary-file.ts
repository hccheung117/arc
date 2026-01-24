/**
 * Messages Binary File Capability
 *
 * Library for business: absorbs path conventions, base64 decoding,
 * mime-to-extension mapping, and directory structure.
 * Business calls attachment verbs, never touches filesystem directly.
 */

import { defineCapability, type FoundationCapabilities } from '@main/kernel/module'

type ScopedBinaryFile = ReturnType<FoundationCapabilities['binaryFile']>

const MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
}

const attachmentDir = (threadId: string) => `app/messages/${threadId}`
const attachmentPath = (threadId: string, filename: string) =>
  `app/messages/${threadId}/${filename}`

export default defineCapability((binaryFile: ScopedBinaryFile) => ({
  /** Builds the canonical filename for an attachment. */
  buildFilename: (messageId: string, index: number, mimeType: string) => {
    const ext = MIME_TO_EXT[mimeType] || 'png'
    return `${messageId}-${index}.${ext}`
  },

  /** Decodes base64 and writes attachment to the thread's attachment directory. */
  write: (threadId: string, filename: string, base64Data: string) =>
    binaryFile.write(attachmentPath(threadId, filename), Buffer.from(base64Data, 'base64')),

  /** Reads an attachment as a Buffer, returns null if missing. */
  read: (threadId: string, filename: string) =>
    binaryFile.read(attachmentPath(threadId, filename)),

  /** Deletes all attachments for a thread. */
  deleteAll: (threadId: string) =>
    binaryFile.deleteDir(attachmentDir(threadId)),

  /** Copies all attachments from one thread to another. */
  copyAll: (sourceId: string, targetId: string) =>
    binaryFile.copyDir(attachmentDir(sourceId), attachmentDir(targetId)),

  /** Copies specific attachment files from one thread to another. */
  copySelective: async (sourceId: string, targetId: string, filenames: string[]) => {
    for (const filename of filenames) {
      await binaryFile.copyFile(
        attachmentPath(sourceId, filename),
        attachmentPath(targetId, filename),
      )
    }
  },
}))
