/**
 * Messages JSON Log Capability
 *
 * Library for business: absorbs schema, paths, and persistence format.
 * Business calls domain verbs (append/read/delete), never touches Foundation directly.
 */

import { z } from 'zod'
import { defineCapability, type FoundationCapabilities } from '@main/kernel/module'

type ScopedJsonLog = ReturnType<FoundationCapabilities['jsonLog']>

// ─────────────────────────────────────────────────────────────────────────────
// Schemas (persistence concern — absorbed by cap)
// ─────────────────────────────────────────────────────────────────────────────

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

export const StoredMessageEventSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant', 'system']).optional(),
  content: z.string().optional(),
  reasoning: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  deleted: z.boolean().optional(),
  parentId: z.string().nullable().optional(),
  attachments: z.array(StoredAttachmentSchema).optional(),
  model: z.string().optional(),
  provider: z.string().optional(),
  usage: UsageSchema.optional(),
})

export type StoredAttachment = z.infer<typeof StoredAttachmentSchema>
export type Usage = z.infer<typeof UsageSchema>
export type StoredMessageEvent = z.infer<typeof StoredMessageEventSchema>

// ─────────────────────────────────────────────────────────────────────────────
// Capability
// ─────────────────────────────────────────────────────────────────────────────

const logPath = (threadId: string) => `app/messages/${threadId}.jsonl`

export default defineCapability((jsonLog: ScopedJsonLog) => ({
  append: (threadId: string, event: StoredMessageEvent) =>
    jsonLog.create(logPath(threadId), StoredMessageEventSchema).append(event),

  read: (threadId: string) =>
    jsonLog.create(logPath(threadId), StoredMessageEventSchema).read(),

  delete: (threadId: string) =>
    jsonLog.create(logPath(threadId), StoredMessageEventSchema).delete(),
}))
