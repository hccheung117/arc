/**
 * Messages JSON Log Capability
 *
 * Library for business: absorbs schema, paths, and persistence format.
 * Business calls domain verbs (append/read/delete), never touches Foundation directly.
 */

import { z } from 'zod'
import { defineCapability } from '@main/kernel/module'

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

// ─────────────────────────────────────────────────────────────────────────────
// Capability
// ─────────────────────────────────────────────────────────────────────────────

const logPath = (threadId) => `app/messages/${threadId}.jsonl`

export default defineCapability((jsonLog) => ({
  append: (threadId, event) =>
    jsonLog.create(logPath(threadId), StoredMessageEventSchema).append(event),

  read: (threadId) =>
    jsonLog.create(logPath(threadId), StoredMessageEventSchema).read(),

  delete: (threadId) =>
    jsonLog.create(logPath(threadId), StoredMessageEventSchema).delete(),

  copy: (sourceId, targetId) =>
    jsonLog.copyFile(logPath(sourceId), logPath(targetId)),
}))
