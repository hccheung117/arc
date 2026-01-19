/**
 * Persona Domain I/O Boundary
 *
 * Filesystem-based persona storage (markdown files in directories).
 * Exports typed storage accessors; validation helpers remain public.
 *
 * PERSONA.md files support optional YAML front matter:
 *   ---
 *   name: Display Name
 *   protected: true
 *   description: A helpful assistant
 *   ---
 *   System prompt content here...
 */

import * as fs from 'fs/promises'
import matter from 'gray-matter'
import { z } from 'zod'
import {
  getAppPersonasDir,
  getAppPersonaDir,
  getAppPersonaPath,
  getProfilePersonasDir,
  getProfilePersonaPath,
} from '@main/kernel/paths.tmp'

// ============================================================================
// PRIVATE SCHEMAS
// ============================================================================

const PERSONA_NAME_REGEX = /^[a-zA-Z0-9_-]+$/

const FrontMatterSchema = z.object({
  name: z.string().optional(),
  protected: z.boolean().optional(),
  description: z.string().optional(),
})

// ============================================================================
// PUBLIC TYPES
// ============================================================================

export type PersonaFrontMatter = z.infer<typeof FrontMatterSchema>

export interface Persona {
  /** Directory name (unique identifier) */
  name: string
  /** Display name: frontMatter.name ?? name */
  displayName: string
  /** Markdown content (body only, no front matter) */
  systemPrompt: string
  source: 'profile' | 'user'
  createdAt: string
  /** Parsed YAML front matter */
  frontMatter: PersonaFrontMatter
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

export function isValidPersonaName(name: string): boolean {
  return name.length >= 1 && name.length <= 50 && PERSONA_NAME_REGEX.test(name)
}

// ============================================================================
// FRONT MATTER PARSING
// ============================================================================

export interface ParsedPersonaFile {
  frontMatter: PersonaFrontMatter
  systemPrompt: string
}

/**
 * Parse PERSONA.md content into front matter and system prompt.
 * Gracefully handles missing/invalid front matter (returns empty object).
 */
export function parsePersonaFile(markdown: string): ParsedPersonaFile {
  const { data, content } = matter(markdown)
  const parsed = FrontMatterSchema.safeParse(data)

  return {
    frontMatter: parsed.success ? parsed.data : {},
    systemPrompt: content.trim(),
  }
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
