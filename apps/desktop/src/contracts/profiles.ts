/**
 * Profiles Contract
 *
 * Profile installation, activation, and lifecycle management.
 */

import { z } from 'zod'
import { contract, op, returns } from '@main/foundation/contract'

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

export interface ModelAssignment {
  provider: string
  model: string
}

/** Active profile details (subset of ArcFile) */
export interface ActiveProfileDetails {
  id: string
  name: string
  modelAssignments?: Record<string, ModelAssignment>
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

  /** Get active profile details */
  getActiveDetails: op(z.void(), returns<ActiveProfileDetails | null>()),
})
