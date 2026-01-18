/**
 * Profile Domain I/O Boundary
 *
 * Disk persistence for settings and profile file parsing.
 * Exports typed storage accessors; schemas remain private.
 */

import { z, ZodError } from 'zod'
import { JsonFile } from '@main/foundation/json-file'
import { getSettingsPath, getProfileArcJsonPath } from '@main/foundation/paths'
import { readFile } from 'node:fs/promises'

// ============================================================================
// PRIVATE SCHEMAS
// ============================================================================

const ModelFilterSchema = z.object({
  mode: z.enum(['allow', 'deny']),
  rules: z.array(z.string()),
})

const StoredFavoriteSchema = z.object({
  providerId: z.string(),
  modelId: z.string(),
})

const StoredSettingsSchema = z.object({
  activeProfileId: z.string().nullable(),
  favorites: z.array(StoredFavoriteSchema),
})

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Schema used only for type derivation
const StoredProviderSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  apiKey: z.string().nullable(),
  baseUrl: z.string().nullable(),
  modelFilter: ModelFilterSchema.optional(),
})

// ArcFile schemas (moved from contracts/profiles.ts)
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

// ============================================================================
// PUBLIC TYPES
// ============================================================================

export type StoredFavorite = z.infer<typeof StoredFavoriteSchema>
export type StoredSettings = z.infer<typeof StoredSettingsSchema>
export type StoredProvider = z.infer<typeof StoredProviderSchema>
export type ArcModelFilter = z.infer<typeof ArcModelFilterSchema>
export type ArcFileProvider = z.infer<typeof ArcFileProviderSchema>
export type ModelAssignment = z.infer<typeof ModelAssignmentSchema>
export type ArcFile = z.infer<typeof ArcFileSchema>

export const ARC_FILE_VERSION = 0

// ============================================================================
// STORAGE ACCESSORS
// ============================================================================

const settingsFile = () =>
  new JsonFile<StoredSettings>(
    getSettingsPath(),
    { activeProfileId: null, favorites: [] },
    StoredSettingsSchema
  )

export const settingsStorage = {
  read: () => settingsFile().read(),
  write: (data: StoredSettings) => settingsFile().write(data),
  update: (updater: (data: StoredSettings) => StoredSettings) => settingsFile().update(updater),
}

// ============================================================================
// ARC FILE PARSING
// ============================================================================

export type ArcFileValidationResult =
  | { valid: true; data: ArcFile }
  | { valid: false; error: string }

export const arcFileParser = {
  /** Validate arc.json content string */
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
        return {
          valid: false,
          error: `Unsupported version ${arcFile.version}. Maximum supported: ${ARC_FILE_VERSION}`,
        }
      }

      return { valid: true, data: arcFile }
    } catch (error) {
      if (error instanceof ZodError) {
        const issue = error.issues[0]
        const path = issue.path.join('.')
        const message = path ? `${path}: ${issue.message}` : issue.message
        return { valid: false, error: message }
      }
      throw error
    }
  },

  /** Read and parse arc.json from a profile directory */
  async read(profileId: string): Promise<ArcFile | null> {
    try {
      const content = await readFile(getProfileArcJsonPath(profileId), 'utf-8')
      const result = this.validate(content)
      return result.valid ? result.data : null
    } catch {
      return null
    }
  },
}
