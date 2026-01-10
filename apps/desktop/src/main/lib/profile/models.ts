/**
 * Model Discovery
 *
 * Caching and filtering for OpenAI-compatible model lists.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { getModelsCachePath } from '@main/foundation/paths'
import { info, error } from '@main/foundation/logger'
import { matchesGlob } from '@main/foundation/glob'
import { createClient } from '@main/lib/ai/client'
import type { Model } from '@arc-types/models'

// ============================================================================
// INTERNAL TYPES
// ============================================================================

interface ModelFilter {
  mode: 'allow' | 'deny'
  rules: string[]
}

interface CachedModel {
  id: string
  name: string
  providerId: string
  providerName: string
  providerType: 'openai'
  fetchedAt: string
}

interface ModelCache {
  models: CachedModel[]
}

interface ProviderInput {
  id: string
  baseUrl?: string | null
  apiKey?: string | null
  filter?: ModelFilter | null
  aliases?: Record<string, string> | null
  providerName: string
}

// --- Pure functions ---

function passesFilter(modelId: string, filter: ModelFilter | null): boolean {
  if (!filter || filter.rules.length === 0) return true
  const matches = filter.rules.some((rule) => matchesGlob(modelId, rule))
  return filter.mode === 'allow' ? matches : !matches
}

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

function transformModels(
  raw: Array<{ id: string }>,
  provider: ProviderInput,
  timestamp: string,
): CachedModel[] {
  return raw
    .filter((m) => passesFilter(m.id, provider.filter ?? null))
    .map((m) => ({
      id: m.id,
      name: provider.aliases?.[m.id] ?? m.id,
      providerId: provider.id,
      providerName: provider.providerName,
      providerType: 'openai' as const,
      fetchedAt: timestamp,
    }))
}

// --- Effectful functions ---

async function fetchModels(provider: ProviderInput): Promise<CachedModel[]> {
  const client = createClient(provider)
  const raw = await client.listModels()
  return transformModels(raw, provider, new Date().toISOString())
}

async function readCache(path: string): Promise<ModelCache> {
  try {
    const content = await readFile(path, 'utf-8')
    return JSON.parse(content) as ModelCache
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { models: [] }
    }
    throw err
  }
}

async function writeCache(path: string, cache: ModelCache): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(cache, null, 2), 'utf-8')
}

// --- Public API ---

/**
 * Syncs models from providers to local cache.
 * Applies baseUrl default internally.
 * Returns true if cache was updated.
 */
export async function syncModels(providers: ProviderInput[]): Promise<boolean> {
  const cachePath = getModelsCachePath()

  if (providers.length === 0) {
    await writeCache(cachePath, { models: [] })
    return true
  }

  const results = await Promise.allSettled(providers.map(fetchModels))

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
