/**
 * Message Domain I/O Boundary
 *
 * Disk persistence for messages and threads.
 * Exports typed storage accessors; schemas remain private.
 */

import * as fs from 'fs/promises'
import { z } from 'zod'
import { JsonFile } from '@main/foundation/json-file'
import { JsonLog } from '@main/foundation/json-log'
import {
  getThreadIndexPath,
  getMessageLogPath,
  getThreadAttachmentsDir,
  getThreadAttachmentPath,
} from '@main/foundation/paths'
import { BranchInfoSchema } from '@contracts/messages'

// ============================================================================
// PRIVATE SCHEMAS
// ============================================================================

const StoredAttachmentSchema = z.object({
  type: z.literal('image'),
  path: z.string(),
  mimeType: z.string(),
})

const UsageSchema = z.object({
  inputTokens: z.number().optional(),
  outputTokens: z.number().optional(),
  totalTokens: z.number().optional(),
  reasoningTokens: z.number().optional(),
  cachedInputTokens: z.number().optional(),
})

const StoredMessageEventSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant', 'system']).optional(),
  content: z.string().optional(),
  reasoning: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  deleted: z.boolean().optional(),
  parentId: z.string().nullable().optional(),
  attachments: z.array(StoredAttachmentSchema).optional(),
  modelId: z.string().optional(),
  providerId: z.string().optional(),
  usage: UsageSchema.optional(),
})

// Recursive type requires explicit annotation
type StoredThreadType = {
  id: string
  title: string | null
  pinned: boolean
  renamed: boolean
  systemPrompt: string | null
  createdAt: string
  updatedAt: string
  children: StoredThreadType[]
}

const StoredThreadSchema: z.ZodType<StoredThreadType> = z.object({
  id: z.string(),
  title: z.string().nullable(),
  pinned: z.boolean(),
  renamed: z.boolean(),
  systemPrompt: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
  children: z.lazy(() => z.array(StoredThreadSchema)).default([]),
})

const StoredThreadIndexSchema = z.object({
  threads: z.array(StoredThreadSchema),
})

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Schema used only for type derivation
const ReduceResultSchema = z.object({
  messages: z.array(StoredMessageEventSchema),
  branchPoints: z.array(BranchInfoSchema),
})

// ============================================================================
// PUBLIC TYPES
// ============================================================================

export type StoredAttachment = z.infer<typeof StoredAttachmentSchema>
export type Usage = z.infer<typeof UsageSchema>
export type StoredMessageEvent = z.infer<typeof StoredMessageEventSchema>
export type StoredThread = StoredThreadType
export type StoredThreadIndex = z.infer<typeof StoredThreadIndexSchema>
export type ReduceResult = z.infer<typeof ReduceResultSchema>

// ============================================================================
// STORAGE ACCESSORS
// ============================================================================

const threadIndexFile = () =>
  new JsonFile<StoredThreadIndex>(getThreadIndexPath(), { threads: [] }, StoredThreadIndexSchema)

const messageLogFile = (threadId: string) =>
  new JsonLog<StoredMessageEvent>(getMessageLogPath(threadId), StoredMessageEventSchema)

export const threadStorage = {
  read: () => threadIndexFile().read(),
  write: (data: StoredThreadIndex) => threadIndexFile().write(data),
  update: (updater: (data: StoredThreadIndex) => StoredThreadIndex) => threadIndexFile().update(updater),
}

export const messageStorage = {
  read: (threadId: string) => messageLogFile(threadId).read(),
  append: (threadId: string, event: StoredMessageEvent) => messageLogFile(threadId).append(event),
  delete: (threadId: string) => messageLogFile(threadId).delete(),
}

// ============================================================================
// ATTACHMENT I/O
// ============================================================================

const MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
}

export const attachmentStorage = {
  /** Build attachment metadata (pure, no I/O) */
  build(messageId: string, index: number, mimeType: string): StoredAttachment {
    const ext = MIME_TO_EXT[mimeType] || 'png'
    const filename = `${messageId}-${index}.${ext}`
    return { type: 'image', path: filename, mimeType }
  },

  /** Write attachment data to disk */
  async write(threadId: string, filename: string, data: string): Promise<void> {
    await fs.mkdir(getThreadAttachmentsDir(threadId), { recursive: true })
    const absolutePath = getThreadAttachmentPath(threadId, filename)
    const buffer = Buffer.from(data, 'base64')
    await fs.writeFile(absolutePath, buffer)
  },

  /** Delete all attachments for a thread */
  async deleteAll(threadId: string): Promise<void> {
    try {
      await fs.rm(getThreadAttachmentsDir(threadId), { recursive: true, force: true })
    } catch {
      // Directory may not exist
    }
  },
}
