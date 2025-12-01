import { modelsFile, settingsFile, type StoredProvider, type StoredModel } from '@main/storage'
import type { Model } from '@arc-types/models'
import { loggingFetch } from './http-logger'

const OPENAI_DEFAULT_BASE_URL = 'https://api.openai.com/v1'

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

/**
 * Fetches models from an OpenAI-compatible provider.
 */
async function fetchOpenAIModels(provider: StoredProvider): Promise<StoredModel[]> {
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
 * Fetches models from all providers and updates the cache.
 * Returns true if models were updated.
 */
export async function fetchAllModels(): Promise<boolean> {
  const settings = await settingsFile().read()

  if (settings.providers.length === 0) {
    console.log('[models] No providers configured, skipping fetch')
    return false
  }

  const allModels: StoredModel[] = []

  const results = await Promise.allSettled(
    settings.providers.map((provider) => fetchOpenAIModels(provider))
  )

  for (const result of results) {
    if (result.status === 'fulfilled') {
      allModels.push(...result.value)
    } else {
      console.error('[models] Provider fetch failed:', result.reason)
    }
  }

  if (allModels.length === 0) {
    console.log('[models] No models fetched')
    return false
  }

  await modelsFile().write({ models: allModels })
  console.log(`[models] Cache updated with ${allModels.length} model(s)`)

  return true
}

/**
 * Returns the list of available models by joining the models cache
 * with provider information from settings.
 *
 * This performs an in-memory JOIN equivalent to the previous SQL query.
 */
export async function getModels(): Promise<Model[]> {
  // Read both storage files
  const [modelsCache, settings] = await Promise.all([
    modelsFile().read(),
    settingsFile().read(),
  ])

  // Build provider lookup map for efficient joins
  const providersById = new Map(
    settings.providers.map((p) => [p.id, p]),
  )

  // Join models with providers (in-memory)
  return modelsCache.models
    .filter((model) => providersById.has(model.providerId))
    .map((model) => {
      const provider = providersById.get(model.providerId)!
      return {
        id: model.id,
        name: model.name,
        provider: {
          id: provider.id,
          name: provider.name,
          type: 'openai',
        },
      }
    })
}
