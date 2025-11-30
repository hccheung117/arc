import { settingsFile, type StoredFavorite } from '@main/storage'

export async function updateProviderConfig(
  providerId: string,
  config: { apiKey?: string; baseUrl?: string },
): Promise<void> {
  await settingsFile().update((settings) => {
    const provider = settings.providers.find((p) => p.id === providerId)
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`)
    }

    // Update fields if provided
    if (config.apiKey !== undefined) {
      provider.apiKey = config.apiKey
    }
    if (config.baseUrl !== undefined) {
      provider.baseUrl = config.baseUrl
    }

    return settings
  })
}

export async function getProviderConfig(providerId: string): Promise<{
  apiKey: string | null
  baseUrl: string | null
}> {
  const settings = await settingsFile().read()
  const provider = settings.providers.find((p) => p.id === providerId)

  if (!provider) {
    throw new Error(`Provider ${providerId} not found`)
  }

  return {
    apiKey: provider.apiKey ?? null,
    baseUrl: provider.baseUrl,
  }
}

/**
 * Generic config get handler.
 * Routes key patterns to appropriate config sources.
 * Currently supports: "provider:{providerId}"
 */
export async function getConfig<T = unknown>(key: string): Promise<T | null> {
  if (key.startsWith('provider:')) {
    const providerId = key.slice('provider:'.length)
    const config = await getProviderConfig(providerId)
    return config as T
  }

  if (key === 'favorites') {
    const settings = await settingsFile().read()
    return (settings.favorites ?? []) as T
  }

  return null
}

/**
 * Generic config set handler.
 * Routes key patterns to appropriate config updaters.
 * Currently supports: "provider:{providerId}"
 */
export async function setConfig<T = unknown>(key: string, value: T): Promise<void> {
  if (key.startsWith('provider:')) {
    const providerId = key.slice('provider:'.length)
    const config = value as { apiKey?: string; baseUrl?: string }
    await updateProviderConfig(providerId, config)
    return
  }

  if (key === 'favorites') {
    const favorites = value as StoredFavorite[]
    await settingsFile().update((settings) => ({
      ...settings,
      favorites,
    }))
  }
}
