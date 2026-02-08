/**
 * Messages Binary File Capability
 *
 * Library for business: absorbs path conventions, base64 decoding,
 * mime-to-extension mapping, and directory structure.
 * Business calls attachment verbs, never touches filesystem directly.
 */

import { defineCapability } from '@main/kernel/module'

const MIME_TO_EXT = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
}

const attachmentDir = (threadId) => `app/messages/${threadId}`
const attachmentPath = (threadId, filename) =>
  `app/messages/${threadId}/${filename}`

export default defineCapability((binaryFile) => ({
  /** Resolves the absolute path for an attachment (for shell.openPath in system viewer). */
  getAbsolutePath: (threadId, filename) =>
    binaryFile.resolve(attachmentPath(threadId, filename)),

  /** Builds the canonical filename for an attachment. */
  buildFilename: (messageId, index, mimeType) => {
    const ext = MIME_TO_EXT[mimeType] || 'png'
    return `${messageId}-${index}.${ext}`
  },

  /** Decodes base64 and writes attachment to the thread's attachment directory. */
  write: (threadId, filename, base64Data) =>
    binaryFile.write(attachmentPath(threadId, filename), Buffer.from(base64Data, 'base64')),

  /** Reads an attachment as a Buffer, returns null if missing. */
  read: (threadId, filename) =>
    binaryFile.read(attachmentPath(threadId, filename)),

  /** Deletes all attachments for a thread. */
  deleteAll: (threadId) =>
    binaryFile.deleteDir(attachmentDir(threadId)),

  /** Copies all attachments from one thread to another. */
  copyAll: (sourceId, targetId) =>
    binaryFile.copyDir(attachmentDir(sourceId), attachmentDir(targetId)),

  /** Copies specific attachment files from one thread to another. */
  copySelective: async (sourceId, targetId, filenames) => {
    for (const filename of filenames) {
      await binaryFile.copyFile(
        attachmentPath(sourceId, filename),
        attachmentPath(targetId, filename),
      )
    }
  },
}))
