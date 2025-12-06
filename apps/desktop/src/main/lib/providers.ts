import { settingsFile, type StoredFavorite } from '@main/storage'
import { getActiveProfile } from './profiles'

/**
 * Parse provider index from runtime ID (profile-provider-{index}).
 */
function parseProviderIndex(providerId: string): number {
  const match = providerId.match(/^profile-provider-(\d+)$/)
  if (!match) {
    throw new Error(`Invalid provider ID format: ${providerId}`)
  }
  return parseInt(match[1], 10)
}

/**
 * Get provider config from active profile.
 * Provider ID format: profile-provider-{index}
 */
export async function getProviderConfig(providerId: string): Promise<{
  type: string
  apiKey: string | null
  baseUrl: string | null
}> {
  const profile = await getActiveProfile()
  if (!profile) {
    throw new Error('No active profile')
  }

  const index = parseProviderIndex(providerId)
  const provider = profile.providers[index]

  if (!provider) {
    throw new Error(`Provider index ${index} not found in active profile`)
  }

  return {
    type: provider.type,
    apiKey: provider.apiKey ?? null,
    baseUrl: provider.baseUrl ?? null,
  }
}

/**
 * Generic config get handler.
 * Routes key patterns to appropriate config sources.
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
 * Note: Provider configs are read-only (come from arc files).
 */
export async function setConfig<T = unknown>(key: string, value: T): Promise<void> {
  if (key.startsWith('provider:')) {
    throw new Error('Provider configs are read-only (managed via arc files)')
  }

  if (key === 'favorites') {
    const favorites = value as StoredFavorite[]
    await settingsFile().update((settings) => ({
      ...settings,
      favorites,
    }))
  }
}
