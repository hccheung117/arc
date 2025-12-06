/**
 * .arc File Validation
 *
 * Validates .arc configuration files against the Zod schema.
 * Import/installation is handled by profiles.ts.
 */

import { ZodError } from 'zod'
import { ArcFileSchema, ARC_FILE_VERSION, type ArcFile } from '@arc-types/arc-file'

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

  try {
    const arcFile = ArcFileSchema.parse(parsed)

    if (arcFile.version > ARC_FILE_VERSION) {
      return {
        valid: false,
        error: `Unsupported version ${arcFile.version}. Maximum supported: ${ARC_FILE_VERSION}`,
      }
    }

    console.log(`[arc:validate] Passed: ${arcFile.name} (${arcFile.providers.length} provider(s))`)
    return { valid: true, data: arcFile }
  } catch (error) {
    if (error instanceof ZodError) {
      const issue = error.issues[0]
      const path = issue.path.join('.')
      const message = path ? `${path}: ${issue.message}` : issue.message
      console.log(`[arc:validate] Failed: ${message}`)
      return { valid: false, error: message }
    }
    throw error
  }
}
