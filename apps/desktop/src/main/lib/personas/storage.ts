/**
 * Persona Domain Storage
 *
 * Filesystem-based storage for personas.
 * Each persona is a folder containing PERSONA.md (plain markdown system prompt).
 *
 * Two-layer resolution:
 * - profiles/{profileId}/personas/{name}/ : Profile personas (read-only)
 * - app/personas/{name}/ : User personas (read-write, shadows profile)
 */

import * as fs from 'fs/promises'
import {
  getAppPersonasDir,
  getAppPersonaDir,
  getAppPersonaPath,
  getProfilePersonasDir,
  getProfilePersonaPath,
} from '@main/foundation/paths'

// ============================================================================
// USER PERSONA I/O
// ============================================================================

/**
 * Reads a user persona's system prompt.
 * Returns null if the persona doesn't exist.
 */
export async function readUserPersona(name: string) {
  try {
    return await fs.readFile(getAppPersonaPath(name), 'utf-8')
  } catch {
    return null
  }
}

/**
 * Writes a user persona's system prompt.
 * Creates the persona directory if it doesn't exist.
 */
export async function writeUserPersona(name: string, systemPrompt: string) {
  const dir = getAppPersonaDir(name)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(getAppPersonaPath(name), systemPrompt, 'utf-8')
}

/**
 * Deletes a user persona.
 * Removes the entire persona directory.
 */
export async function deleteUserPersona(name: string) {
  await fs.rm(getAppPersonaDir(name), { recursive: true, force: true })
}

/**
 * Lists all user persona names.
 * Returns folder names in app/personas/.
 */
export async function listUserPersonaNames() {
  const dir = getAppPersonasDir()
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    return entries.filter((e) => e.isDirectory()).map((e) => e.name)
  } catch {
    return []
  }
}

/**
 * Checks if a user persona exists.
 */
export async function userPersonaExists(name: string) {
  try {
    await fs.access(getAppPersonaPath(name))
    return true
  } catch {
    return false
  }
}

// ============================================================================
// PROFILE PERSONA I/O
// ============================================================================

/**
 * Reads a profile persona's system prompt.
 * Returns null if the persona doesn't exist.
 */
export async function readProfilePersona(profileId: string, name: string) {
  try {
    return await fs.readFile(getProfilePersonaPath(profileId, name), 'utf-8')
  } catch {
    return null
  }
}

/**
 * Lists all profile persona names for a given profile.
 * Returns folder names in profiles/{profileId}/personas/.
 */
export async function listProfilePersonaNames(profileId: string) {
  const dir = getProfilePersonasDir(profileId)
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    return entries.filter((e) => e.isDirectory()).map((e) => e.name)
  } catch {
    return []
  }
}
