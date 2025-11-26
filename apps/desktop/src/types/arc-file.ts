/**
 * .arc File Schema (Version 0)
 *
 * Portable configuration format for Arc application.
 * Version 0 supports provider import only.
 */

/** Schema version for migration support */
export const ARC_FILE_VERSION = 0

/** Provider entry in .arc file */
export interface ArcFileProvider {
  type: string // Provider type identifier ('openai', 'anthropic', 'ollama')
  baseUrl?: string // Optional custom endpoint
  apiKey?: string // Optional API key (plain text in file)
}

/** Root .arc file structure */
export interface ArcFile {
  version: number
  providers: ArcFileProvider[]
}

/** Import result for UI feedback */
export interface ArcImportResult {
  success: boolean
  providersAdded: number
  providersUpdated: number
  errors: string[]
}

/** Import event pushed to renderer */
export type ArcImportEvent =
  | { type: 'success'; result: ArcImportResult }
  | { type: 'error'; error: string }
