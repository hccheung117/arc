/**
 * Profiles Contract
 *
 * Profile installation, activation, and lifecycle management.
 * Also includes ArcFile schemas for file I/O boundary validation.
 */

import { z } from 'zod'
import { contract, op, returns } from '@main/foundation/contract'

// ============================================================================
// ARC FILE SCHEMAS (file I/O boundary - Zod validation required)
// ============================================================================

/** Schema version for migration support */
export const ARC_FILE_VERSION = 0

export const ArcModelFilterSchema = z.object({
  mode: z.enum(['allow', 'deny']),
  rules: z.array(z.string()),
})
export type ArcModelFilter = z.infer<typeof ArcModelFilterSchema>

export const ArcFileProviderSchema = z.object({
  type: z.string(),
  baseUrl: z.string().optional(),
  apiKey: z.string().optional(),
  modelFilter: ArcModelFilterSchema.optional(),
  modelAliases: z.record(z.string(), z.string()).optional(),
})
export type ArcFileProvider = z.infer<typeof ArcFileProviderSchema>

export const ArcFileSchema = z.object({
  version: z.number(),
  id: z.string(),
  name: z.string(),
  providers: z.array(ArcFileProviderSchema),
  updateInterval: z.number().min(1).optional(),
})
export type ArcFile = z.infer<typeof ArcFileSchema>

// ============================================================================
// IPC OUTPUT TYPES
// ============================================================================

export interface ProfileInfo {
  id: string
  name: string
  providerCount: number
}

export interface ProfileInstallResult {
  id: string
  name: string
  providerCount: number
}

// ============================================================================
// CONTRACT
// ============================================================================

export const profilesContract = contract('profiles', {
  /** List installed profiles */
  list: op(z.void(), [] as ProfileInfo[]),

  /** Get active profile ID */
  getActive: op(z.void(), null as string | null),

  /** Install a profile from file path */
  install: op(
    z.object({ filePath: z.string() }),
    returns<ProfileInstallResult>(),
  ),

  /** Uninstall a profile */
  uninstall: op(z.object({ profileId: z.string() }), undefined as void),

  /** Activate a profile (or null to deactivate) */
  activate: op(z.object({ profileId: z.string().nullable() }), undefined as void),
})
