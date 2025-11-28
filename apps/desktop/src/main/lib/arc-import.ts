/**
 * .arc File Import Logic
 *
 * Handles validation and import of .arc configuration files.
 * Provider matching uses functional identity for portability:
 * 1. Match by baseUrl if present (supports proxies/custom endpoints)
 * 2. Fall back to matching by type (one standard config per provider type)
 */

import { createId } from '@paralleldrive/cuid2'
import { settingsFile, type StoredProvider } from '@main/storage'
import {
  ARC_FILE_VERSION,
  type ArcFile,
  type ArcFileProvider,
  type ArcImportResult,
} from '@arc-types/arc-file'

interface ValidationResult {
  valid: boolean
  data?: ArcFile
  error?: string
}

/**
 * Validates .arc file content against the schema.
 */
export function validateArcFile(content: string): ValidationResult {
  console.log('[arc:import] Validating file content')

  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    console.log('[arc:import] Validation failed: Invalid JSON')
    return { valid: false, error: 'Invalid JSON format' }
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { valid: false, error: 'Invalid file structure' }
  }

  const file = parsed as Record<string, unknown>

  if (typeof file.version !== 'number') {
    return { valid: false, error: 'Missing version field' }
  }

  if (file.version > ARC_FILE_VERSION) {
    return {
      valid: false,
      error: `Unsupported version ${file.version}. Maximum supported: ${ARC_FILE_VERSION}`,
    }
  }

  if (!Array.isArray(file.providers)) {
    return { valid: false, error: 'Missing or invalid providers array' }
  }

  for (const provider of file.providers) {
    if (typeof provider !== 'object' || provider === null) {
      return { valid: false, error: 'Invalid provider entry' }
    }

    const p = provider as Record<string, unknown>

    if (typeof p.type !== 'string' || p.type.trim() === '') {
      return { valid: false, error: 'Provider missing required "type" field' }
    }

    if (p.baseUrl !== undefined && typeof p.baseUrl !== 'string') {
      return { valid: false, error: 'Provider baseUrl must be a string' }
    }

    if (p.apiKey !== undefined && typeof p.apiKey !== 'string') {
      return { valid: false, error: 'Provider apiKey must be a string' }
    }
  }

  const arcFile = parsed as ArcFile
  console.log(`[arc:import] Validation passed: ${arcFile.providers.length} provider(s)`)
  return { valid: true, data: arcFile }
}

/**
 * Finds a matching provider using functional identity resolution:
 * 1. If incoming has baseUrl, match by type AND baseUrl
 * 2. Otherwise, match by type only (first match)
 */
function findMatchingProvider(
  providers: StoredProvider[],
  incoming: ArcFileProvider
): StoredProvider | undefined {
  if (incoming.baseUrl) {
    return providers.find(
      (p) => p.type === incoming.type && p.baseUrl === incoming.baseUrl
    )
  }
  return providers.find((p) => p.type === incoming.type)
}

/**
 * Converts provider type to display name.
 */
function formatProviderName(type: string): string {
  const names: Record<string, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    ollama: 'Ollama',
    google: 'Google AI',
  }
  return names[type] || type.charAt(0).toUpperCase() + type.slice(1)
}

/**
 * Imports providers from .arc file using upsert semantics.
 */
export async function importArcFile(arcFile: ArcFile): Promise<ArcImportResult> {
  console.log('[arc:import] Starting import')

  const result: ArcImportResult = {
    success: true,
    providersAdded: 0,
    providersUpdated: 0,
    errors: [],
  }

  await settingsFile().update((settings) => {
    for (const incoming of arcFile.providers) {
      const existing = findMatchingProvider(settings.providers, incoming)

      if (existing) {
        if (incoming.baseUrl !== undefined) {
          existing.baseUrl = incoming.baseUrl || null
        }
        if (incoming.apiKey !== undefined) {
          existing.apiKey = incoming.apiKey || null
        }
        result.providersUpdated++
      } else {
        const newProvider: StoredProvider = {
          id: createId(),
          name: formatProviderName(incoming.type),
          type: incoming.type,
          apiKey: incoming.apiKey || null,
          baseUrl: incoming.baseUrl || null,
        }
        settings.providers.push(newProvider)
        result.providersAdded++
      }
    }
    return settings
  })

  console.log(`[arc:import] Complete: ${result.providersAdded} added, ${result.providersUpdated} updated`)
  return result
}
