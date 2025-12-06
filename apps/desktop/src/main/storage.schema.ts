/**
 * Storage Layer Zod Schemas
 *
 * Single source of truth for all on-disk data structures.
 * Types are derived from these schemas using z.infer<>.
 */

import { z } from 'zod'

// ============================================================================
// SETTINGS
// ============================================================================

export const StoredFavoriteSchema = z.object({
  providerId: z.string(),
  modelId: z.string(),
})

export const StoredSettingsSchema = z.object({
  activeProfileId: z.string().nullable(),
  favorites: z.array(StoredFavoriteSchema),
})

export const StoredModelFilterSchema = z.object({
  mode: z.enum(['allow', 'deny']),
  rules: z.array(z.string()),
})

export const StoredProviderSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  apiKey: z.string().nullable(),
  baseUrl: z.string().nullable(),
  modelFilter: StoredModelFilterSchema.optional(),
})

// ============================================================================
// MODELS CACHE
// ============================================================================

export const StoredModelSchema = z.object({
  id: z.string(),
  providerId: z.string(),
  name: z.string(),
  contextWindow: z.number().optional(),
  fetchedAt: z.string(),
})

export const StoredModelCacheSchema = z.object({
  models: z.array(StoredModelSchema),
})

// ============================================================================
// THREAD INDEX
// ============================================================================

export const StoredThreadSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  pinned: z.boolean(),
  renamed: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const StoredThreadIndexSchema = z.object({
  threads: z.array(StoredThreadSchema),
})

// ============================================================================
// MESSAGE EVENTS
// ============================================================================

export const StoredAttachmentSchema = z.object({
  type: z.literal('image'),
  path: z.string(),
  mimeType: z.string(),
})

export const UsageSchema = z.object({
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
  parentId: z.string().nullable(),
  attachments: z.array(StoredAttachmentSchema).optional(),
  modelId: z.string(),
  providerId: z.string(),
  usage: UsageSchema.optional(),
})

export const StoredThreadMetaEventSchema = z.object({
  type: z.literal('thread_meta'),
  activePath: z.array(z.string()),
  updatedAt: z.string(),
})

export const ThreadEventSchema = z.union([
  StoredMessageEventSchema,
  StoredThreadMetaEventSchema,
])

// ============================================================================
// BRANCH INFO
// ============================================================================

export const BranchInfoSchema = z.object({
  parentId: z.string().nullable(),
  branches: z.array(z.string()),
  currentIndex: z.number(),
})

export const ReduceResultSchema = z.object({
  messages: z.array(StoredMessageEventSchema),
  branchPoints: z.array(BranchInfoSchema),
})
