/**
 * Settings Business Logic
 *
 * Generic key-value settings with routing:
 * - `provider:*` keys route to profiles module (read-only)
 * - `favorites` key routes to local settings.json
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFunction = (...args: any[]) => any

interface StoredFavorite {
  providerId: string
  modelId: string
}

interface StoredSettings {
  activeProfileId: string | null
  favorites: StoredFavorite[]
}

interface SettingsStore {
  read(): Promise<StoredSettings>
  update(fn: (data: StoredSettings) => StoredSettings): Promise<void>
}

interface ProfilesAPI {
  getProviderConfig(providerId: string): Promise<unknown>
}

export interface SettingsOperations extends Record<string, AnyFunction> {
  get(key: string): Promise<unknown>
  set(key: string, value: unknown): Promise<void>
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────────

export const createSettingsOperations = (
  store: SettingsStore,
  profilesApi: ProfilesAPI
): SettingsOperations => {
  const get = async (key: string): Promise<unknown> => {
    // Route provider configs to profiles module
    if (key.startsWith('provider:')) {
      const providerId = key.slice('provider:'.length)
      return await profilesApi.getProviderConfig(providerId)
    }

    // Route favorites to settings file
    if (key === 'favorites') {
      const settings = await store.read()
      return settings.favorites ?? []
    }

    return null
  }

  const set = async (key: string, value: unknown): Promise<void> => {
    // Provider configs are read-only
    if (key.startsWith('provider:')) {
      throw new Error('Provider configs are read-only (managed via arc files)')
    }

    // Write favorites to settings file
    if (key === 'favorites') {
      const favorites = value as StoredFavorite[]
      await store.update((settings) => ({
        ...settings,
        favorites,
      }))
    }
  }

  return { get, set }
}
