/**
 * .arc File Schema (Version 0)
 *
 * Portable configuration format for Arc application.
 * Version 0 supports provider import only.
 */

/** Schema version for migration support */
export const ARC_FILE_VERSION = 0

/** Model filter configuration */
export interface ArcModelFilter {
  mode: 'allow' | 'deny'
  rules: string[]
}

/** Provider entry in .arc file */
export interface ArcFileProvider {
  type: string // Provider type identifier ('openai', 'anthropic', 'ollama')
  baseUrl?: string // Optional custom endpoint
  apiKey?: string // Optional API key (plain text in file)
  modelFilter?: ArcModelFilter // Optional model visibility filter
  modelAliases?: Record<string, string> // Optional model id -> display name overrides
}

/** Root .arc file structure */
export interface ArcFile {
  version: number
  id: string // Profile identity (cuid2, embedded in file)
  name: string // Display name for the profile
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

/** Profile metadata for UI display */
export interface ProfileInfo {
  id: string
  name: string
  providerCount: number
}

/** Profile install result */
export interface ProfileInstallResult {
  id: string
  name: string
  providerCount: number
}

/** Profile lifecycle events */
export type ProfilesEvent =
  | { type: 'installed'; profile: ProfileInstallResult }
  | { type: 'uninstalled'; profileId: string }
  | { type: 'activated'; profileId: string | null }
