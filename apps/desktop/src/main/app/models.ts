/**
 * Models Orchestration
 *
 * Composes lib/models with profile data and IPC events.
 * Defaults and business policy live here, not in the lib.
 */

import { fetchModels, readCache, writeCache } from '@main/lib/models/fetch'
import type { CachedModel } from '@main/lib/models/types'
import { generateProviderId } from '@main/lib/profile/operations'
import { getModelsCachePath } from '@main/lib/arcfs/paths'
import { broadcast } from '@main/foundation/ipc'
import { info, error } from '@main/foundation/logger'
import type { ArcFile } from '@arc-types/arc-file'
import type { Model } from '@arc-types/models'

// ============================================================================
// DEFAULTS
// ============================================================================

const OPENAI_BASE_URL = 'https://api.openai.com/v1'

// ============================================================================
// EVENTS
// ============================================================================

export type ModelsEvent = { type: 'updated' }

export function emitModelsEvent(event: ModelsEvent): void {
  broadcast('arc:models:event', event)
}

// ============================================================================
// TRANSFORMS
// ============================================================================

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

// ============================================================================
// OPERATIONS
// ============================================================================

/**
 * Syncs models from all providers in the profile to local cache.
 * Clears cache if profile is null or has no providers.
 * Returns true if cache was updated.
 */
export async function syncModels(profile: ArcFile | null): Promise<boolean> {
  const cachePath = getModelsCachePath()

  if (!profile || profile.providers.length === 0) {
    await writeCache(cachePath, { models: [] })
    return true
  }

  const results = await Promise.allSettled(
    profile.providers.map((p) =>
      fetchModels({
        baseUrl: p.baseUrl ?? OPENAI_BASE_URL,
        apiKey: p.apiKey ?? null,
        filter: p.modelFilter ?? null,
        aliases: p.modelAliases ?? null,
        providerId: generateProviderId(p),
        providerName: profile.name,
      })
    )
  )

  const models: CachedModel[] = []
  for (const result of results) {
    if (result.status === 'fulfilled') {
      models.push(...result.value)
    } else {
      error('models', 'Provider fetch failed', result.reason as Error)
    }
  }

  await writeCache(cachePath, { models })
  info('models', `Cache updated with ${models.length} model(s)`)

  return true
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
