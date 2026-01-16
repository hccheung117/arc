/**
 * Persona Domain Schemas
 *
 * Zod schemas for persona validation:
 * - Individual persona (folder-based with PERSONA.md)
 * - Name validation for filesystem safety
 */

import { z } from 'zod'

// ============================================================================
// NAME VALIDATION
// ============================================================================

/**
 * Regex for valid persona names.
 * Allows alphanumeric, underscore, and hyphen.
 * No spaces or special characters (filesystem-safe).
 */
export const PERSONA_NAME_REGEX = /^[a-zA-Z0-9_-]+$/

/**
 * Validates a persona name for filesystem safety.
 */
export function isValidPersonaName(name: string): boolean {
  return name.length >= 1 && name.length <= 50 && PERSONA_NAME_REGEX.test(name)
}

// ============================================================================
// PERSONA SCHEMAS
// ============================================================================

export const PersonaSchema = z.object({
  name: z.string().min(1).max(50).regex(PERSONA_NAME_REGEX),
  systemPrompt: z.string(),
  source: z.enum(['profile', 'user']),
  createdAt: z.string(),
})
export type Persona = z.infer<typeof PersonaSchema>
