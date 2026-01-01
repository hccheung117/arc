/**
 * Model Operations
 *
 * Read-only operations on model cache.
 */

import { readCache } from './fetch'
import { getModelsCachePath } from '@main/foundation/paths'
import type { CachedModel } from './types'
import type { Model } from '@arc-types/models'

function toPublicModel(cached: CachedModel): Model {
  return {
    id: cached.id,
    name: cached.name,
    provider: {
      id: cached.providerId,
      name: cached.providerName,
      type: cached.providerType,
    },
  }
}

/**
 * Lists all cached models.
 */
export async function listModels(): Promise<Model[]> {
  const cache = await readCache(getModelsCachePath())
  return cache.models.map(toPublicModel)
}

/**
 * Finds the provider ID for a given model ID.
 * Throws if model not found in cache.
 */
export async function lookupModelProvider(modelId: string): Promise<string> {
  const cache = await readCache(getModelsCachePath())
  const model = cache.models.find((m) => m.id === modelId)
  if (!model) throw new Error(`Model ${modelId} not found`)
  return model.providerId
}
