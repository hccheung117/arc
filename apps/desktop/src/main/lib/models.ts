import { modelsFile, type StoredModel, type StoredModelFilter } from '@main/storage'
import type { Model } from '@arc-types/models'
import type { ArcFileProvider } from '@arc-types/arc-file'
import { broadcast } from './ipc'
import { info, error, logFetch } from './logger'
import { getActiveProfile, generateProviderId } from './profile'

// ============================================================================
// MODELS EVENTS
// ============================================================================

export type ModelsEvent = { type: 'updated' }

export function emitModelsEvent(event: ModelsEvent): void {
  broadcast('arc:models:event', event)
}

const OPENAI_DEFAULT_BASE_URL = 'https://api.openai.com/v1'

/**
 * Tests if a model ID matches a glob pattern (supports * wildcard).
 */
function matchesGlob(value: string, pattern: string): boolean {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp('^' + escaped.replace(/\*/g, '.*') + '$')
  return regex.test(value)
}

/**
 * Applies a model filter to determine visibility.
 * Returns true if the model should be shown, false if hidden.
 */
function passesFilter(modelId: string, filter: StoredModelFilter | undefined): boolean {
  if (!filter || filter.rules.length === 0) return true

  const matches = filter.rules.some((rule) => matchesGlob(modelId, rule))
  return filter.mode === 'allow' ? matches : !matches
}

interface OpenAIModel {
  id: string
  object: string
  created: number
  owned_by: string
}

interface OpenAIModelsResponse {
  object: string
  data: OpenAIModel[]
}

/** Provider with stable content-based ID for model fetching */
interface RuntimeProvider {
  id: string // 8-char SHA-256 hash of type|apiKey|baseUrl
  type: string
  apiKey?: string
  baseUrl?: string
  modelFilter?: StoredModelFilter
  modelAliases?: Record<string, string>
}

/** Intermediate type for raw fetched model data before filtering/aliasing */
interface RawFetchedModel {
  id: string
  fetchedAt: string
}

/**
 * Fetches models from an OpenAI-compatible provider.
 * Returns raw model data for processing by fetchAllModels().
 */
async function fetchOpenAIModels(provider: RuntimeProvider): Promise<RawFetchedModel[]> {
  const baseUrl = provider.baseUrl || OPENAI_DEFAULT_BASE_URL
  const endpoint = `${baseUrl}/models`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (provider.apiKey) {
    headers['Authorization'] = `Bearer ${provider.apiKey}`
  }

  const response = await logFetch(endpoint, { headers })

  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as OpenAIModelsResponse
  const now = new Date().toISOString()

  return data.data.map((m) => ({
    id: m.id,
    fetchedAt: now,
  }))
}

/**
 * Converts ArcFileProvider to RuntimeProvider with stable content-based ID.
 */
function toRuntimeProvider(provider: ArcFileProvider): RuntimeProvider {
  return {
    id: generateProviderId(provider),
    type: provider.type,
    apiKey: provider.apiKey,
    baseUrl: provider.baseUrl,
    modelFilter: provider.modelFilter,
    modelAliases: provider.modelAliases,
  }
}

/**
 * Fetches models from all providers in the active profile.
 * Applies modelFilter and modelAliases before caching, making the cache
 * the single source of truth for the renderer.
 */
export async function fetchAllModels(): Promise<boolean> {
  const profile = await getActiveProfile()

  if (!profile || profile.providers.length === 0) {
    await modelsFile().write({ models: [] })
    return true
  }

  const runtimeProviders = profile.providers.map(toRuntimeProvider)
  const allModels: StoredModel[] = []

  const results = await Promise.allSettled(
    runtimeProviders.map((provider) => fetchOpenAIModels(provider))
  )

  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    const provider = runtimeProviders[i]

    if (result.status === 'fulfilled') {
      // Apply filter and aliases at cache time
      const filteredModels = result.value
        .filter((m) => passesFilter(m.id, provider.modelFilter))
        .map((m) => ({
          id: m.id,
          name: provider.modelAliases?.[m.id] ?? m.id,
          providerId: provider.id,
          providerName: profile.name,
          providerType: 'openai' as const,
          fetchedAt: m.fetchedAt,
        }))

      allModels.push(...filteredModels)
    } else {
      error('models', 'Provider fetch failed', result.reason as Error)
    }
  }

  await modelsFile().write({ models: allModels })
  info('models', `Cache updated with ${allModels.length} model(s)`)

  return true
}


/**
 * Returns the list of available models from cache.
 * Cache is pre-filtered and aliased by fetchAllModels(), so this is a simple read.
 */
export async function getModels(): Promise<Model[]> {
  const modelsCache = await modelsFile().read()

  return modelsCache.models.map((m) => ({
    id: m.id,
    name: m.name,
    provider: {
      id: m.providerId,
      name: m.providerName,
      type: m.providerType,
    },
  }))
}

/**
 * Initialize models on app startup.
 * Fetches all models and emits update event if changes detected.
 */
export async function initModels(): Promise<void> {
  try {
    const updated = await fetchAllModels()
    if (updated) emitModelsEvent({ type: 'updated' })
  } catch (err) {
    error('models', 'Startup fetch failed', err as Error)
  }
}
