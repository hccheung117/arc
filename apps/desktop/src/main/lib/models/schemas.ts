/**
 * Models Domain Schemas
 *
 * Zod schemas for model caching and filtering:
 * - Cached model metadata
 * - Model filter rules (allow/deny)
 */

import { z } from 'zod'

// ============================================================================
// MODEL FILTER SCHEMAS
// ============================================================================

export const StoredModelFilterSchema = z.object({
  mode: z.enum(['allow', 'deny']),
  rules: z.array(z.string()),
})
export type StoredModelFilter = z.infer<typeof StoredModelFilterSchema>

// ============================================================================
// MODEL CACHE SCHEMAS
// ============================================================================

export const StoredModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  providerId: z.string(),
  providerName: z.string(),
  providerType: z.literal('openai'),
  contextWindow: z.number().optional(),
  fetchedAt: z.string(),
})
export type StoredModel = z.infer<typeof StoredModelSchema>

export const StoredModelCacheSchema = z.object({
  models: z.array(StoredModelSchema),
})
export type StoredModelCache = z.infer<typeof StoredModelCacheSchema>
