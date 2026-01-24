/**
 * Profiles JSON File Capability Adapter
 *
 * Library for business: absorbs settings, arc.json parsing, and model cache schemas/paths.
 */

import { z } from 'zod'
import { defineCapability, type FoundationCapabilities } from '@main/kernel/module'

type ScopedJsonFile = ReturnType<FoundationCapabilities['jsonFile']>

// ─────────────────────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────────────────────

const StoredFavoriteSchema = z.object({
  providerId: z.string(),
  modelId: z.string(),
})

const StoredSettingsSchema = z.object({
  activeProfileId: z.string().nullable(),
  favorites: z.array(StoredFavoriteSchema),
})

const ArcModelFilterSchema = z.object({
  mode: z.enum(['allow', 'deny']),
  rules: z.array(z.string()),
})

const ArcFileProviderSchema = z.object({
  type: z.string(),
  baseUrl: z.string().optional(),
  apiKey: z.string().optional(),
  modelFilter: ArcModelFilterSchema.optional(),
  modelAliases: z.record(z.string(), z.string()).optional(),
})

const ModelAssignmentSchema = z.object({
  provider: z.string(),
  model: z.string(),
})

const ArcFileSchema = z.object({
  version: z.number(),
  id: z.string(),
  name: z.string(),
  providers: z.array(ArcFileProviderSchema),
  updateInterval: z.number().min(1).optional(),
  modelAssignments: z.record(z.string(), ModelAssignmentSchema).optional(),
  favoriteModels: z.array(ModelAssignmentSchema).optional(),
})

const CachedModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  providerId: z.string(),
  providerName: z.string(),
  providerType: z.literal('openai'),
  fetchedAt: z.string(),
})

const ModelCacheSchema = z.object({
  models: z.array(CachedModelSchema),
})

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type StoredFavorite = z.infer<typeof StoredFavoriteSchema>
export type StoredSettings = z.infer<typeof StoredSettingsSchema>
export type ArcFile = z.infer<typeof ArcFileSchema>
export type ArcFileProvider = z.infer<typeof ArcFileProviderSchema>
export type ArcModelFilter = z.infer<typeof ArcModelFilterSchema>
export type CachedModel = z.infer<typeof CachedModelSchema>

export const ARC_FILE_VERSION = 0

export type ArcFileValidationResult =
  | { valid: true; data: ArcFile }
  | { valid: false; error: string }

// ─────────────────────────────────────────────────────────────────────────────
// Capability
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: StoredSettings = { activeProfileId: null, favorites: [] }
const DEFAULT_CACHE = { models: [] as CachedModel[] }

export default defineCapability((jsonFile: ScopedJsonFile) => {
  const settingsFile = jsonFile.create('app/settings.json', DEFAULT_SETTINGS, StoredSettingsSchema)
  const cacheFile = jsonFile.create('app/cache/models.cache.json', DEFAULT_CACHE, ModelCacheSchema)

  return {
    settings: {
      read: () => settingsFile.read(),
      update: (updater: (data: StoredSettings) => StoredSettings) => settingsFile.update(updater),
    },

    arcFile: {
      validate(content: string): ArcFileValidationResult {
        let parsed: unknown
        try {
          parsed = JSON.parse(content)
        } catch {
          return { valid: false, error: 'Invalid JSON format' }
        }

        try {
          const arcFile = ArcFileSchema.parse(parsed)
          if (arcFile.version > ARC_FILE_VERSION) {
            return { valid: false, error: `Unsupported version ${arcFile.version}. Maximum supported: ${ARC_FILE_VERSION}` }
          }
          return { valid: true, data: arcFile }
        } catch (error) {
          if (error instanceof z.ZodError) {
            const issue = error.issues[0]
            const path = issue.path.join('.')
            return { valid: false, error: path ? `${path}: ${issue.message}` : issue.message }
          }
          throw error
        }
      },
    },

    modelsCache: {
      read: async () => {
        const cache = await cacheFile.read()
        return cache.models
      },
      write: (models: CachedModel[]) => cacheFile.write({ models }),
    },
  }
})
