/**
 * Persona Operations
 *
 * Domain logic for persona CRUD operations.
 * Pure functions that interact with storage.
 */

import { createId } from '@paralleldrive/cuid2'
import { personasFile } from './storage'
import type { Persona } from './schemas'

/**
 * List all personas.
 */
export async function listPersonas() {
  const store = await personasFile().read()
  return store.personas
}

/**
 * Create a new persona.
 * Validates name (1-50 chars) and persists to storage.
 */
export async function createPersona(name: string, systemPrompt: string) {
  const trimmedName = name.trim()
  if (trimmedName.length === 0 || trimmedName.length > 50) {
    throw new Error('Persona name must be 1-50 characters')
  }

  const persona: Persona = {
    id: createId(),
    name: trimmedName,
    systemPrompt,
    createdAt: new Date().toISOString(),
  }

  await personasFile().update((store) => ({
    personas: [...store.personas, persona],
  }))

  return persona
}
