/**
 * Models Library Types
 *
 * Pure types for model fetching and caching.
 */

// ============================================================================
// FILTER
// ============================================================================

export interface ModelFilter {
  mode: 'allow' | 'deny'
  rules: string[]
}

// ============================================================================
// CACHE
// ============================================================================

export interface CachedModel {
  id: string
  name: string
  providerId: string
  providerName: string
  providerType: 'openai'
  fetchedAt: string
}

export interface ModelCache {
  models: CachedModel[]
}

// ============================================================================
// SYNC INPUT
// ============================================================================

/**
 * Provider data for model sync.
 * Caller provides pre-computed IDs — lib stays pure.
 */
export interface SyncProvider {
  id: string
  baseUrl: string
  apiKey: string | null
  filter: ModelFilter | null
  aliases: Record<string, string> | null
  name: string
}

// ============================================================================
// FETCH INPUT
// ============================================================================

export interface FetchOptions {
  baseUrl: string
  apiKey: string | null
  filter: ModelFilter | null
  aliases: Record<string, string> | null
  providerId: string
  providerName: string
}
