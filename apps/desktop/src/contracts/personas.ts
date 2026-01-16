/**
 * Personas Contract
 *
 * Persona CRUD operations.
 * Two-layer architecture: profile personas (read-only) + user personas (read-write).
 */

import { z } from 'zod'
import { contract, op, returns } from '@main/foundation/contract'

// ============================================================================
// TYPES
// ============================================================================

export interface Persona {
  name: string
  systemPrompt: string
  source: 'profile' | 'user'
  createdAt: string
}

// ============================================================================
// CONTRACT
// ============================================================================

export const personasContract = contract('personas', {
  /** List all personas with shadow resolution */
  list: op(z.void(), [] as Persona[]),

  /** Create a new user persona */
  create: op(
    z.object({
      name: z.string(),
      systemPrompt: z.string(),
    }),
    returns<Persona>(),
  ),

  /** Update a user persona */
  update: op(
    z.object({
      name: z.string(),
      systemPrompt: z.string(),
    }),
    returns<Persona>(),
  ),

  /** Delete a user persona */
  delete: op(z.object({ name: z.string() }), undefined as void),
})
