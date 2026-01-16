/**
 * Settings Contract
 *
 * Generic key-value store.
 * Type parameter T is provided by caller at the call site.
 */

import { z } from 'zod'
import { contract, op } from '@main/foundation/contract'

// ============================================================================
// CONTRACT
// ============================================================================

export const settingsContract = contract('settings', {
  /** Get a setting value by key */
  get: op(z.object({ key: z.string() }), null as unknown),

  /** Set a setting value */
  set: op(
    z.object({
      key: z.string(),
      value: z.unknown(),
    }),
    undefined as void,
  ),
})

// ============================================================================
// CUSTOM CLIENT TYPE (for generics)
// ============================================================================

/**
 * Settings API with generic type parameters.
 * Used to override the inferred type in preload.
 */
export interface SettingsAPI {
  get<T = unknown>(input: { key: string }): Promise<T | null>
  set<T = unknown>(input: { key: string; value: T }): Promise<void>
}
