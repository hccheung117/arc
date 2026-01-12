/**
 * Persona Domain Storage
 *
 * Config archetype: array of user-created personas.
 * Replaced atomically as a single document.
 */

import { JsonFile } from '@main/foundation/json-file'
import { getPersonasPath } from '@main/foundation/paths'
import { PersonasStoreSchema, type PersonasStore } from './schemas'

/**
 * Returns a JsonFile engine for the personas.json file.
 *
 * Default: Empty personas array.
 * Format: Standard JSON Object with personas array.
 * Safety: Atomic write via write-file-atomic + Zod validation.
 */
export function personasFile(): JsonFile<PersonasStore> {
  const defaultValue: PersonasStore = { personas: [] }
  return new JsonFile(getPersonasPath(), defaultValue, PersonasStoreSchema)
}
