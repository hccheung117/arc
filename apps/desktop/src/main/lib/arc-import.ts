/**
 * .arc File Validation
 *
 * Validates .arc configuration files against the schema.
 * Import/installation is handled by profiles.ts.
 */

import { ARC_FILE_VERSION, type ArcFile } from '@arc-types/arc-file'

export interface ValidationResult {
  valid: boolean
  data?: ArcFile
  error?: string
}

/**
 * Validates .arc file content against the schema.
 */
export function validateArcFile(content: string): ValidationResult {
  console.log('[arc:validate] Validating file content')

  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    console.log('[arc:validate] Failed: Invalid JSON')
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

  if (typeof file.id !== 'string' || file.id.trim() === '') {
    return { valid: false, error: 'Missing or invalid id field' }
  }

  if (typeof file.name !== 'string' || file.name.trim() === '') {
    return { valid: false, error: 'Missing or invalid name field' }
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

    if (p.modelFilter !== undefined) {
      if (typeof p.modelFilter !== 'object' || p.modelFilter === null) {
        return { valid: false, error: 'Provider modelFilter must be an object' }
      }
      const filter = p.modelFilter as Record<string, unknown>
      if (filter.mode !== 'allow' && filter.mode !== 'deny') {
        return { valid: false, error: 'Provider modelFilter.mode must be "allow" or "deny"' }
      }
      if (!Array.isArray(filter.rules)) {
        return { valid: false, error: 'Provider modelFilter.rules must be an array' }
      }
      for (const rule of filter.rules) {
        if (typeof rule !== 'string') {
          return { valid: false, error: 'Provider modelFilter.rules must contain only strings' }
        }
      }
    }

    if (p.modelAliases !== undefined) {
      if (typeof p.modelAliases !== 'object' || p.modelAliases === null || Array.isArray(p.modelAliases)) {
        return { valid: false, error: 'Provider modelAliases must be an object' }
      }
      for (const [key, value] of Object.entries(p.modelAliases)) {
        if (typeof key !== 'string' || typeof value !== 'string') {
          return { valid: false, error: 'Provider modelAliases must map string keys to string values' }
        }
      }
    }
  }

  const arcFile = parsed as ArcFile
  console.log(`[arc:validate] Passed: ${arcFile.name} (${arcFile.providers.length} provider(s))`)
  return { valid: true, data: arcFile }
}
