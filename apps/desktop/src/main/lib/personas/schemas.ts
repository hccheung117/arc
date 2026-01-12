/**
 * Persona Domain Schemas
 *
 * Zod schemas for persona persistence:
 * - Individual persona validation
 * - Personas file structure
 */

import { z } from 'zod'

// ============================================================================
// PERSONA SCHEMAS
// ============================================================================

export const PersonaSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(50),
  systemPrompt: z.string(),
  createdAt: z.string(),
})
export type Persona = z.infer<typeof PersonaSchema>

export const PersonasStoreSchema = z.object({
  personas: z.array(PersonaSchema),
})
export type PersonasStore = z.infer<typeof PersonasStoreSchema>
