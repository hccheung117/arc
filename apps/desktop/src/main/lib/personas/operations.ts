/**
 * Persona Operations
 *
 * Domain logic for persona CRUD operations.
 * Implements two-layer resolution: user personas shadow profile personas.
 */

import matter from 'gray-matter'
import { getActiveProfileId } from '@main/lib/profile/operations'
import {
  userPersonaStorage,
  profilePersonaStorage,
  isValidPersonaName,
  parsePersonaFile,
  type Persona,
} from '@boundary/personas'

// ============================================================================
// LIST PERSONAS
// ============================================================================

/**
 * List all personas with two-layer resolution.
 * User personas shadow profile personas with the same name.
 */
export async function listPersonas() {
  const activeProfileId = await getActiveProfileId()

  // Gather profile personas
  const profileNames = activeProfileId ? await profilePersonaStorage.list(activeProfileId) : []
  const profilePersonas: Persona[] = []

  for (const name of profileNames) {
    const rawContent = activeProfileId
      ? await profilePersonaStorage.read(activeProfileId, name)
      : null
    if (rawContent !== null) {
      const { frontMatter, systemPrompt } = parsePersonaFile(rawContent)
      profilePersonas.push({
        name,
        displayName: frontMatter.name ?? name,
        systemPrompt,
        source: 'profile',
        createdAt: '',
        frontMatter,
      })
    }
  }

  // Gather user personas
  const userNames = await userPersonaStorage.list()
  const userPersonas: Persona[] = []

  for (const name of userNames) {
    const rawContent = await userPersonaStorage.read(name)
    if (rawContent !== null) {
      const { frontMatter, systemPrompt } = parsePersonaFile(rawContent)
      userPersonas.push({
        name,
        displayName: frontMatter.name ?? name,
        systemPrompt,
        source: 'user',
        createdAt: '',
        frontMatter,
      })
    }
  }

  // Merge: user personas shadow profile personas
  const userNameSet = new Set(userNames)
  const merged = [
    ...profilePersonas.filter((p) => !userNameSet.has(p.name)),
    ...userPersonas,
  ]

  // Sort alphabetically by displayName
  return merged.sort((a, b) => a.displayName.localeCompare(b.displayName))
}

// ============================================================================
// GET PERSONA
// ============================================================================

/**
 * Get a single persona by name with two-layer resolution.
 * User persona shadows profile persona.
 */
export async function getPersona(name: string) {
  // Check user layer first (shadow)
  const userContent = await userPersonaStorage.read(name)
  if (userContent !== null) {
    const { frontMatter, systemPrompt } = parsePersonaFile(userContent)
    return {
      name,
      displayName: frontMatter.name ?? name,
      systemPrompt,
      source: 'user' as const,
      createdAt: '',
      frontMatter,
    }
  }

  // Check profile layer
  const activeProfileId = await getActiveProfileId()
  if (activeProfileId) {
    const profileContent = await profilePersonaStorage.read(activeProfileId, name)
    if (profileContent !== null) {
      const { frontMatter, systemPrompt } = parsePersonaFile(profileContent)
      return {
        name,
        displayName: frontMatter.name ?? name,
        systemPrompt,
        source: 'profile' as const,
        createdAt: '',
        frontMatter,
      }
    }
  }

  return null
}

// ============================================================================
// CREATE PERSONA
// ============================================================================

/**
 * Create a new user persona.
 * Validates name for filesystem safety.
 * Will shadow any profile persona with the same name.
 */
export async function createPersona(name: string, systemPrompt: string) {
  if (!isValidPersonaName(name)) {
    throw new Error(
      'Persona name must be 1-50 characters, using only letters, numbers, underscore, and hyphen'
    )
  }

  // Check if already exists as user persona
  if (await userPersonaStorage.exists(name)) {
    throw new Error(`Persona "${name}" already exists`)
  }

  await userPersonaStorage.write(name, systemPrompt)

  // User-created personas have no front matter initially
  return {
    name,
    displayName: name,
    systemPrompt,
    source: 'user' as const,
    createdAt: new Date().toISOString(),
    frontMatter: {},
  }
}

// ============================================================================
// UPDATE PERSONA
// ============================================================================

/**
 * Update an existing user persona's system prompt.
 * Cannot update profile personas (they are read-only).
 * Preserves existing front matter when updating.
 */
export async function updatePersona(name: string, systemPrompt: string) {
  // Only user personas can be updated
  const existingContent = await userPersonaStorage.read(name)
  if (existingContent === null) {
    throw new Error(`User persona "${name}" not found`)
  }

  // Parse existing front matter to preserve it
  const { frontMatter } = parsePersonaFile(existingContent)

  // Reconstruct file with preserved front matter using gray-matter for proper YAML
  const hasFrontMatter = Object.keys(frontMatter).length > 0
  const newContent = hasFrontMatter
    ? matter.stringify(systemPrompt, frontMatter)
    : systemPrompt

  await userPersonaStorage.write(name, newContent)

  return {
    name,
    displayName: frontMatter.name ?? name,
    systemPrompt,
    source: 'user' as const,
    createdAt: '',
    frontMatter,
  }
}

// ============================================================================
// DELETE PERSONA
// ============================================================================

/**
 * Delete a user persona by name.
 * Cannot delete profile personas (they are read-only).
 */
export async function deletePersona(name: string) {
  // Only user personas can be deleted
  if (!(await userPersonaStorage.exists(name))) {
    throw new Error(`User persona "${name}" not found`)
  }

  await userPersonaStorage.delete(name)
}
