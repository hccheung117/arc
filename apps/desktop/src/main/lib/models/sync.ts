/**
 * Model Sync
 *
 * Fetches models from providers and updates local cache.
 * Accepts pre-computed provider data — no cross-lib dependencies.
 */

import { fetchModels, writeCache } from './fetch'
import { getModelsCachePath } from '@main/foundation/paths'
import { info, error } from '@main/foundation/logger'
import type { SyncProvider, CachedModel } from './types'

/**
 * Syncs models from providers to local cache.
 * Clears cache if providers array is empty.
 * Returns true if cache was updated.
 */
export async function syncModels(providers: SyncProvider[]): Promise<boolean> {
  const cachePath = getModelsCachePath()

  if (providers.length === 0) {
    await writeCache(cachePath, { models: [] })
    return true
  }

  const results = await Promise.allSettled(
    providers.map((p) =>
      fetchModels({
        baseUrl: p.baseUrl,
        apiKey: p.apiKey,
        filter: p.filter,
        aliases: p.aliases,
        providerId: p.id,
        providerName: p.name,
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
