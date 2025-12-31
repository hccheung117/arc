/**
 * Profile Domain Schemas
 *
 * Zod schemas for profile/settings persistence:
 * - App settings (active profile, favorites)
 * - Provider configuration
 */

import { z } from 'zod'

// ============================================================================
// MODEL FILTER SCHEMA
// ============================================================================

const ModelFilterSchema = z.object({
  mode: z.enum(['allow', 'deny']),
  rules: z.array(z.string()),
})

// ============================================================================
// FAVORITES SCHEMAS
// ============================================================================

export const StoredFavoriteSchema = z.object({
  providerId: z.string(),
  modelId: z.string(),
})
export type StoredFavorite = z.infer<typeof StoredFavoriteSchema>

// ============================================================================
// SETTINGS SCHEMAS
// ============================================================================

export const StoredSettingsSchema = z.object({
  activeProfileId: z.string().nullable(),
  favorites: z.array(StoredFavoriteSchema),
})
export type StoredSettings = z.infer<typeof StoredSettingsSchema>

// ============================================================================
// PROVIDER SCHEMAS
// ============================================================================

export const StoredProviderSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  apiKey: z.string().nullable(),
  baseUrl: z.string().nullable(),
  modelFilter: ModelFilterSchema.optional(),
})
export type StoredProvider = z.infer<typeof StoredProviderSchema>
