import { modelsFile, type StoredModel, type StoredModelFilter } from '@main/storage'
import type { Model } from '@arc-types/models'
import { loggingFetch } from './http-logger'
import { getActiveProfile } from './profiles'
import type { ArcFileProvider } from '@arc-types/arc-file'

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

/** Provider with runtime ID for model fetching */
interface RuntimeProvider {
  id: string // profile-provider-{index}
  type: string
  apiKey?: string
  baseUrl?: string
  modelFilter?: StoredModelFilter
  modelAliases?: Record<string, string>
}

/**
 * Fetches models from an OpenAI-compatible provider.
 */
async function fetchOpenAIModels(provider: RuntimeProvider): Promise<StoredModel[]> {
  const baseUrl = provider.baseUrl || OPENAI_DEFAULT_BASE_URL
  const endpoint = `${baseUrl}/models`

  console.log(`[models] Fetching from ${endpoint}`)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (provider.apiKey) {
    headers['Authorization'] = `Bearer ${provider.apiKey}`
  }

  const response = await loggingFetch(endpoint, { headers })

  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as OpenAIModelsResponse
  const now = new Date().toISOString()

  return data.data.map((m) => ({
    id: m.id,
    providerId: provider.id,
    name: m.id,
    fetchedAt: now,
  }))
}

/**
 * Converts ArcFileProvider to RuntimeProvider with index-based ID.
 */
function toRuntimeProvider(provider: ArcFileProvider, index: number): RuntimeProvider {
  return {
    id: `profile-provider-${index}`,
    type: provider.type,
    apiKey: provider.apiKey,
    baseUrl: provider.baseUrl,
    modelFilter: provider.modelFilter,
    modelAliases: provider.modelAliases,
  }
}

/**
 * Fetches models from all providers in the active profile.
 * Returns true if models were updated, false if no profile active.
 */
export async function fetchAllModels(): Promise<boolean> {
  const profile = await getActiveProfile()

  if (!profile) {
    console.log('[models] No active profile, clearing cache')
    await modelsFile().write({ models: [] })
    return true
  }

  if (profile.providers.length === 0) {
    console.log('[models] Active profile has no providers, clearing cache')
    await modelsFile().write({ models: [] })
    return true
  }

  const runtimeProviders = profile.providers.map(toRuntimeProvider)
  const allModels: StoredModel[] = []

  const results = await Promise.allSettled(
    runtimeProviders.map((provider) => fetchOpenAIModels(provider))
  )

  for (const result of results) {
    if (result.status === 'fulfilled') {
      allModels.push(...result.value)
    } else {
      console.error('[models] Provider fetch failed:', result.reason)
    }
  }

  await modelsFile().write({ models: allModels })
  console.log(`[models] Cache updated with ${allModels.length} model(s)`)

  return true
}

/**
 * Formats provider type to display name.
 */
function formatProviderName(type: string): string {
  const names: Record<string, string> = {
    openai: 'OpenAI',
  }
  return names[type] || type.charAt(0).toUpperCase() + type.slice(1)
}

/**
 * Returns the list of available models by joining the models cache
 * with provider information from the active profile.
 */
export async function getModels(): Promise<Model[]> {
  const [modelsCache, profile] = await Promise.all([modelsFile().read(), getActiveProfile()])

  if (!profile) {
    return []
  }

  // Build provider lookup map: profile-provider-{index} -> RuntimeProvider
  const providersById = new Map(
    profile.providers.map((p, i) => {
      const runtime = toRuntimeProvider(p, i)
      return [runtime.id, runtime] as const
    })
  )

  // Join models with providers and apply filters
  return modelsCache.models
    .filter((model) => {
      const provider = providersById.get(model.providerId)
      if (!provider) return false
      return passesFilter(model.id, provider.modelFilter)
    })
    .map((model) => {
      const provider = providersById.get(model.providerId)!
      // Priority: alias > cached name > id
      const displayName = provider.modelAliases?.[model.id] ?? model.name ?? model.id
      return {
        id: model.id,
        name: displayName,
        provider: {
          id: provider.id,
          name: formatProviderName(provider.type),
          type: 'openai',
        },
      }
    })
}
