/**
 * Models Domain Storage
 *
 * Config archetype: transient cache that can be regenerated.
 * Replaced atomically on each fetch—never modified in place.
 */

import { JsonFile } from '@main/foundation/json-file'
import { getModelsCachePath } from '@main/lib/arcfs/paths'
import {
  StoredModelCacheSchema,
  type StoredModelCache,
} from './schemas'

/**
 * Returns a JsonFile engine for the models.cache.json file.
 *
 * Default: Empty models array.
 * Format: Standard JSON Object.
 * Safety: Atomic write via write-file-atomic + Zod validation.
 * Lifecycle: Transient, can be regenerated.
 */
export function modelsFile(): JsonFile<StoredModelCache> {
  const defaultValue: StoredModelCache = { models: [] }
  return new JsonFile(getModelsCachePath(), defaultValue, StoredModelCacheSchema)
}
