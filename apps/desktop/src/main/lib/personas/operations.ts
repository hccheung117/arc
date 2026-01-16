/**
 * Persona Operations
 *
 * Domain logic for persona CRUD operations.
 * Implements two-layer resolution: user personas shadow profile personas.
 */

import { getActiveProfileId } from '@main/lib/profile/operations'
import {
  userPersonaStorage,
  profilePersonaStorage,
  isValidPersonaName,
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
    const systemPrompt = activeProfileId ? await profilePersonaStorage.read(activeProfileId, name) : null
    if (systemPrompt !== null) {
      profilePersonas.push({
        name,
        systemPrompt,
        source: 'profile',
        createdAt: '',
      })
    }
  }

  // Gather user personas
  const userNames = await userPersonaStorage.list()
  const userPersonas: Persona[] = []

  for (const name of userNames) {
    const systemPrompt = await userPersonaStorage.read(name)
    if (systemPrompt !== null) {
      userPersonas.push({
        name,
        systemPrompt,
        source: 'user',
        createdAt: '',
      })
    }
  }

  // Merge: user personas shadow profile personas
  const userNameSet = new Set(userNames)
  const merged = [
    ...profilePersonas.filter((p) => !userNameSet.has(p.name)),
    ...userPersonas,
  ]

  // Sort alphabetically by name
  return merged.sort((a, b) => a.name.localeCompare(b.name))
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
  const userPrompt = await userPersonaStorage.read(name)
  if (userPrompt !== null) {
    return {
      name,
      systemPrompt: userPrompt,
      source: 'user' as const,
      createdAt: '',
    }
  }

  // Check profile layer
  const activeProfileId = await getActiveProfileId()
  if (activeProfileId) {
    const profilePrompt = await profilePersonaStorage.read(activeProfileId, name)
    if (profilePrompt !== null) {
      return {
        name,
        systemPrompt: profilePrompt,
        source: 'profile' as const,
        createdAt: '',
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

  return {
    name,
    systemPrompt,
    source: 'user' as const,
    createdAt: new Date().toISOString(),
  }
}

// ============================================================================
// UPDATE PERSONA
// ============================================================================

/**
 * Update an existing user persona's system prompt.
 * Cannot update profile personas (they are read-only).
 */
export async function updatePersona(name: string, systemPrompt: string) {
  // Only user personas can be updated
  if (!(await userPersonaStorage.exists(name))) {
    throw new Error(`User persona "${name}" not found`)
  }

  await userPersonaStorage.write(name, systemPrompt)

  return {
    name,
    systemPrompt,
    source: 'user' as const,
    createdAt: '',
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
