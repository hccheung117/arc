/**
 * Models Library
 *
 * Fetches models from OpenAI-compatible providers and manages local cache.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { transform } from './utils'
import type { CachedModel, ModelCache, FetchOptions } from './types'

// ============================================================================
// WIRE FORMAT
// ============================================================================

interface OpenAIModelsResponse {
  data: Array<{ id: string }>
}

// ============================================================================
// FETCH
// ============================================================================

/**
 * Fetches models from a single OpenAI-compatible provider.
 * Returns transformed and filtered models ready for caching.
 */
export async function fetchModels(options: FetchOptions): Promise<CachedModel[]> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (options.apiKey) {
    headers['Authorization'] = `Bearer ${options.apiKey}`
  }

  const response = await fetch(`${options.baseUrl}/models`, { headers })

  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as OpenAIModelsResponse
  const timestamp = new Date().toISOString()

  return transform(data.data, options, timestamp)
}

// ============================================================================
// CACHE I/O
// ============================================================================

const EMPTY_CACHE: ModelCache = { models: [] }

/**
 * Reads model cache from disk.
 * Returns empty cache if file doesn't exist.
 */
export async function readCache(path: string): Promise<ModelCache> {
  try {
    const content = await readFile(path, 'utf-8')
    return JSON.parse(content) as ModelCache
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return EMPTY_CACHE
    }
    throw error
  }
}

/**
 * Writes model cache to disk atomically.
 */
export async function writeCache(path: string, cache: ModelCache): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(cache, null, 2), 'utf-8')
}
