/**
 * Profile Domain Storage
 *
 * Config archetype: singular state governing application behavior.
 * Replaced atomically as a single document—never modified in place.
 */

import { JsonFile } from '@main/foundation/json-file'
import { getSettingsPath } from '@main/lib/arcfs/paths'
import {
  StoredSettingsSchema,
  type StoredSettings,
} from './schemas'

/**
 * Returns a JsonFile engine for the settings.json file.
 *
 * Default: Empty providers array.
 * Format: Standard JSON Object.
 * Safety: Atomic write via write-file-atomic + Zod validation.
 */
export function settingsFile(): JsonFile<StoredSettings> {
  const defaultValue: StoredSettings = { activeProfileId: null, favorites: [] }
  return new JsonFile(getSettingsPath(), defaultValue, StoredSettingsSchema)
}
