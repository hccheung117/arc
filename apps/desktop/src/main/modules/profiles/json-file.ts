/**
 * Profiles JSON File Capability Adapter
 *
 * Library for business: absorbs arc.json parsing, profile settings parsing, and model cache schemas/paths.
 */

import { z } from 'zod'
import { defineCapability, type FoundationCapabilities } from '@main/kernel/module'

type ScopedJsonFile = ReturnType<FoundationCapabilities['jsonFile']>

// ─────────────────────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────────────────────

const ArcModelFilterSchema = z.object({
  mode: z.enum(['allow', 'deny']),
  rules: z.array(z.string()),
})

const ArcFileProviderSchema = z.object({
  id: z.string().min(1),
  type: z.string(),
  baseUrl: z.string().optional(),
  apiKey: z.string().optional(),
  modelFilter: ArcModelFilterSchema.optional(),
  modelAliases: z.record(z.string(), z.string()).optional(),
})

const AssignmentSchema = z.object({
  provider: z.string(),
  model: z.string(),
})

const ArcFileSchema = z.object({
  version: z.number(),
  id: z.string(),
  name: z.string(),
  providers: z.array(ArcFileProviderSchema),
  updateInterval: z.number().min(1).optional(),
})

const ShortcutsSchema = z.object({
  send: z.enum(['enter', 'shift+enter']),
})

const ProfileSettingsSchema = z.object({
  favorites: z.array(AssignmentSchema).optional(),
  assignments: z.record(z.string(), AssignmentSchema).optional(),
  shortcuts: ShortcutsSchema.optional(),
})

const CachedModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.string(),
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

export type ArcFile = z.infer<typeof ArcFileSchema>
export type ArcFileProvider = z.infer<typeof ArcFileProviderSchema>
export type ArcModelFilter = z.infer<typeof ArcModelFilterSchema>
export type CachedModel = z.infer<typeof CachedModelSchema>
export type ProfileSettings = z.infer<typeof ProfileSettingsSchema>

export const ARC_FILE_VERSION = 0

export type ArcFileValidationResult =
  | { valid: true; data: ArcFile }
  | { valid: false; error: string }

export type ProfileSettingsValidationResult =
  | { valid: true; data: ProfileSettings }
  | { valid: false; error: string }

// ─────────────────────────────────────────────────────────────────────────────
// Capability
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_CACHE = { models: [] as CachedModel[] }

export default defineCapability((jsonFile: ScopedJsonFile) => {
  const cacheFile = jsonFile.create('app/cache/models.cache.json', DEFAULT_CACHE, ModelCacheSchema)

  return {
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

          // Validate unique provider IDs
          const providerIds = new Set<string>()
          for (const provider of arcFile.providers) {
            if (providerIds.has(provider.id)) {
              return { valid: false, error: `Duplicate provider id: ${provider.id}` }
            }
            providerIds.add(provider.id)
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

    profileSettings: {
      validate(content: string): ProfileSettingsValidationResult {
        let parsed: unknown
        try {
          parsed = JSON.parse(content)
        } catch {
          return { valid: false, error: 'Invalid JSON format' }
        }

        try {
          const settings = ProfileSettingsSchema.parse(parsed)
          return { valid: true, data: settings }
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
