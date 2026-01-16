/**
 * Profiles Contract
 *
 * Profile installation, activation, and lifecycle management.
 */

import { z } from 'zod'
import { contract, op, returns } from '@main/foundation/contract'
import type { ProfileInfo, ProfileInstallResult } from '@arc-types/arc-file'

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
