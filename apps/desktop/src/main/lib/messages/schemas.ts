/**
 * Message Domain Schemas
 *
 * Zod schemas for message persistence:
 * - Message events (event sourcing)
 * - Thread metadata
 * - Branch information
 * - Attachments
 */

import { z } from 'zod'
import { BranchInfoSchema } from '@arc-types/arc-api'

// ============================================================================
// ATTACHMENT SCHEMAS
// ============================================================================

export const StoredAttachmentSchema = z.object({
  type: z.literal('image'),
  path: z.string(),
  mimeType: z.string(),
})
export type StoredAttachment = z.infer<typeof StoredAttachmentSchema>

// ============================================================================
// USAGE SCHEMAS
// ============================================================================

export const UsageSchema = z.object({
  inputTokens: z.number().optional(),
  outputTokens: z.number().optional(),
  totalTokens: z.number().optional(),
  reasoningTokens: z.number().optional(),
  cachedInputTokens: z.number().optional(),
})
export type Usage = z.infer<typeof UsageSchema>

// ============================================================================
// MESSAGE EVENT SCHEMAS
// ============================================================================

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
// THREAD INDEX SCHEMAS
// ============================================================================

/**
 * Recursive thread schema - threads can contain other threads (folders).
 * A thread with non-empty children[] acts as a folder.
 * Schema allows infinite nesting; UI limits to 1 level.
 */
export type StoredThread = {
  id: string
  title: string | null
  pinned: boolean
  renamed: boolean
  systemPrompt: string | null
  createdAt: string
  updatedAt: string
  children: StoredThread[]
}

export const StoredThreadSchema: z.ZodType<StoredThread> = z.object({
  id: z.string(),
  title: z.string().nullable(),
  pinned: z.boolean(),
  renamed: z.boolean(),
  systemPrompt: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
  children: z.lazy(() => z.array(StoredThreadSchema)).default([]),
})

export const StoredThreadIndexSchema = z.object({
  threads: z.array(StoredThreadSchema),
})
export type StoredThreadIndex = z.infer<typeof StoredThreadIndexSchema>

export const ReduceResultSchema = z.object({
  messages: z.array(StoredMessageEventSchema),
  branchPoints: z.array(BranchInfoSchema),
})
