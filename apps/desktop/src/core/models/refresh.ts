import OpenAI from 'openai'
import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { models, providers } from '@/db/schema'
import { getProviderConfig } from '../providers/handlers'

interface ModelInfo {
  id: string
  name: string
}

/**
 * Fetch available models from an OpenAI provider
 */
async function fetchOpenAIModels(apiKey: string, baseUrl?: string | null): Promise<ModelInfo[]> {
  const client = new OpenAI({
    apiKey,
    ...(baseUrl && { baseURL: baseUrl }),
  })

  try {
    const modelsList = await client.models.list()
    const fetchedModels: ModelInfo[] = []

    for await (const model of modelsList) {
      fetchedModels.push({
        id: model.id,
        name: model.id, // Use ID as name by default
      })
    }

    return fetchedModels
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch models from OpenAI: ${error.message}`)
    }
    throw error
  }
}

/**
 * Sync fetched models to database for a provider
 * - Inserts new models with active=1
 * - Marks models not in fetched list as active=0
 */
async function syncModelsToDatabase(
  providerId: string,
  fetchedModels: ModelInfo[],
): Promise<{ added: number; deactivated: number }> {
  const fetchedModelIds = new Set(fetchedModels.map((m) => m.id))

  // Get existing models for this provider
  const existingModels = await db
    .select({ id: models.id, active: models.active })
    .from(models)
    .where(eq(models.providerId, providerId))

  const existingModelIds = new Set(existingModels.map((m) => m.id))

  let added = 0
  let deactivated = 0

  // Insert new models
  for (const model of fetchedModels) {
    if (!existingModelIds.has(model.id)) {
      await db.insert(models).values({
        id: model.id,
        name: model.name,
        providerId,
        active: 1,
      })
      added++
    } else {
      // Reactivate if previously deactivated
      const existing = existingModels.find((m) => m.id === model.id)
      if (existing && existing.active === 0) {
        await db
          .update(models)
          .set({ active: 1 })
          .where(eq(models.id, model.id))
        added++ // Count reactivations as additions
      }
    }
  }

  // Deactivate models not in fetched list
  for (const existing of existingModels) {
    if (!fetchedModelIds.has(existing.id) && existing.active === 1) {
      await db.update(models).set({ active: 0 }).where(eq(models.id, existing.id))
      deactivated++
    }
  }

  return { added, deactivated }
}

/**
 * Refresh models for a single provider
 */
async function refreshProviderModels(providerId: string, providerType: string): Promise<void> {
  try {
    const config = await getProviderConfig(providerId)

    if (!config.apiKey) {
      console.log(`[Model Refresh] Skipping ${providerId}: No API key configured`)
      return
    }

    // Only support OpenAI and OpenAI-compatible providers for now
    if (providerType !== 'openai' && providerType !== 'openai-compatible') {
      console.log(
        `[Model Refresh] Skipping ${providerId}: Provider type ${providerType} not supported for auto-refresh`,
      )
      return
    }

    console.log(`[Model Refresh] Fetching models for ${providerId}...`)
    const fetchedModels = await fetchOpenAIModels(config.apiKey, config.baseUrl)

    console.log(`[Model Refresh] Found ${fetchedModels.length} models for ${providerId}`)
    const { added, deactivated } = await syncModelsToDatabase(providerId, fetchedModels)

    console.log(
      `[Model Refresh] ${providerId}: +${added} models added/reactivated, ${deactivated} deactivated`,
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[Model Refresh] Failed to refresh ${providerId}: ${errorMessage}`)
  }
}

/**
 * Refresh all configured providers
 * Runs in background on app start
 */
export async function refreshAllModels(): Promise<void> {
  try {
    console.log('[Model Refresh] Starting background model refresh...')

    // Get all providers
    const allProviders = await db.select().from(providers)

    if (allProviders.length === 0) {
      console.log('[Model Refresh] No providers configured')
      return
    }

    // Refresh each provider
    const refreshPromises = allProviders.map((provider) =>
      refreshProviderModels(provider.id, provider.type),
    )

    await Promise.allSettled(refreshPromises)

    console.log('[Model Refresh] Background refresh complete')
  } catch (error) {
    console.error('[Model Refresh] Fatal error during refresh:', error)
  }
}
