/**
 * Models Library Utilities
 *
 * Pure internal helpers for filtering and transforming model data.
 */

import type { ModelFilter, CachedModel, FetchOptions } from './types'

// ============================================================================
// FILTER HELPERS
// ============================================================================

/**
 * Tests if a value matches a glob pattern (supports * wildcard).
 */
export function matchesGlob(value: string, pattern: string): boolean {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp('^' + escaped.replace(/\*/g, '.*') + '$')
  return regex.test(value)
}

/**
 * Determines if a model passes the filter rules.
 * Returns true if the model should be included.
 */
export function passesFilter(modelId: string, filter: ModelFilter | null): boolean {
  if (!filter || filter.rules.length === 0) return true
  const matches = filter.rules.some((rule) => matchesGlob(modelId, rule))
  return filter.mode === 'allow' ? matches : !matches
}

// ============================================================================
// TRANSFORM
// ============================================================================

interface RawModel {
  id: string
}

/**
 * Transforms raw API response to cached models.
 * Applies filter and aliases.
 */
export function transform(
  raw: RawModel[],
  options: FetchOptions,
  timestamp: string
): CachedModel[] {
  return raw
    .filter((m) => passesFilter(m.id, options.filter))
    .map((m) => ({
      id: m.id,
      name: options.aliases?.[m.id] ?? m.id,
      providerId: options.providerId,
      providerName: options.providerName,
      providerType: 'openai' as const,
      fetchedAt: timestamp,
    }))
}
