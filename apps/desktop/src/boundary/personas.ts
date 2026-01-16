/**
 * Persona Domain I/O Boundary
 *
 * Filesystem-based persona storage (markdown files in directories).
 * Exports typed storage accessors; validation helpers remain public.
 */

import * as fs from 'fs/promises'
import { z } from 'zod'
import {
  getAppPersonasDir,
  getAppPersonaDir,
  getAppPersonaPath,
  getProfilePersonasDir,
  getProfilePersonaPath,
} from '@main/foundation/paths'

// ============================================================================
// PRIVATE SCHEMAS
// ============================================================================

const PERSONA_NAME_REGEX = /^[a-zA-Z0-9_-]+$/

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Schema used only for type derivation
const PersonaSchema = z.object({
  name: z.string().min(1).max(50).regex(PERSONA_NAME_REGEX),
  systemPrompt: z.string(),
  source: z.enum(['profile', 'user']),
  createdAt: z.string(),
})

// ============================================================================
// PUBLIC TYPES
// ============================================================================

export type Persona = z.infer<typeof PersonaSchema>

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

export function isValidPersonaName(name: string): boolean {
  return name.length >= 1 && name.length <= 50 && PERSONA_NAME_REGEX.test(name)
}

// ============================================================================
// STORAGE ACCESSORS
// ============================================================================

export const userPersonaStorage = {
  /** Read user persona markdown file */
  async read(name: string): Promise<string | null> {
    try {
      return await fs.readFile(getAppPersonaPath(name), 'utf-8')
    } catch {
      return null
    }
  },

  /** Write user persona markdown file */
  async write(name: string, systemPrompt: string): Promise<void> {
    const dir = getAppPersonaDir(name)
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(getAppPersonaPath(name), systemPrompt, 'utf-8')
  },

  /** Delete user persona directory */
  async delete(name: string): Promise<void> {
    await fs.rm(getAppPersonaDir(name), { recursive: true, force: true })
  },

  /** List all user persona names */
  async list(): Promise<string[]> {
    try {
      const entries = await fs.readdir(getAppPersonasDir(), { withFileTypes: true })
      return entries.filter((e) => e.isDirectory()).map((e) => e.name)
    } catch {
      return []
    }
  },

  /** Check if user persona exists */
  async exists(name: string): Promise<boolean> {
    try {
      await fs.access(getAppPersonaPath(name))
      return true
    } catch {
      return false
    }
  },
}

export const profilePersonaStorage = {
  /** Read profile persona markdown file */
  async read(profileId: string, name: string): Promise<string | null> {
    try {
      return await fs.readFile(getProfilePersonaPath(profileId, name), 'utf-8')
    } catch {
      return null
    }
  },

  /** List all profile persona names for a profile */
  async list(profileId: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(getProfilePersonasDir(profileId), { withFileTypes: true })
      return entries.filter((e) => e.isDirectory()).map((e) => e.name)
    } catch {
      return []
    }
  },
}
