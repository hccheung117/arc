import { modelsFile, settingsFile } from '@main/storage'
import type { Model } from '@arc-types/models'

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
    settings.providers
      .filter((p) => p.isEnabled)
      .map((p) => [p.id, p]),
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
          type: provider.type as 'openai' | 'anthropic' | 'google' | 'mistral',
        },
      }
    })
}
