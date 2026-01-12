/**
 * Path Management
 *
 * Platform-agnostic path construction for the arcfs data layer.
 * SOLE OWNER of all on-disk layout decisions within ArcFS.
 * Directory names, file names, extensions, and path structures are defined here
 * and nowhere else.
 */

import { app } from 'electron'
import * as path from 'path'

// ============================================================================
// ROOT
// ============================================================================

/**
 * Returns the root data directory path.
 * Platform-specific via Electron's app.getPath('userData').
 *
 * Example (macOS): ~/Library/Application Support/arc/arcfs/
 */
export function getDataDir(): string {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, 'arcfs')
}

// ============================================================================
// MESSAGES
// ============================================================================

/**
 * Returns the messages directory path.
 * Contains thread logs (.jsonl) and attachment subdirectories.
 */
export function getMessagesDir(): string {
  return path.join(getDataDir(), 'messages')
}

/**
 * Returns the absolute path to a thread's attachment directory.
 */
export function getThreadAttachmentsDir(threadId: string): string {
  return path.join(getMessagesDir(), threadId)
}

/**
 * Returns the absolute file path for an attachment.
 */
export function getThreadAttachmentPath(threadId: string, relativePath: string): string {
  return path.join(getThreadAttachmentsDir(threadId), relativePath)
}

/**
 * Returns the thread index file path.
 */
export function getThreadIndexPath(): string {
  return path.join(getMessagesDir(), 'index.json')
}

/**
 * Returns the message log file path for a thread.
 */
export function getMessageLogPath(threadId: string): string {
  return path.join(getMessagesDir(), `${threadId}.jsonl`)
}

// ============================================================================
// PROFILES
// ============================================================================

/**
 * Returns the profiles directory path.
 */
export function getProfilesDir(): string {
  return path.join(getDataDir(), 'profiles')
}

/**
 * Returns the profile file path for a profile ID.
 */
export function getProfilePath(profileId: string): string {
  return path.join(getProfilesDir(), `${profileId}.arc`)
}

/**
 * Returns the settings file path.
 */
export function getSettingsPath(): string {
  return path.join(getDataDir(), 'settings.json')
}

// ============================================================================
// PERSONAS
// ============================================================================

/**
 * Returns the personas file path.
 */
export function getPersonasPath(): string {
  return path.join(getDataDir(), 'personas.json')
}

// ============================================================================
// MODELS
// ============================================================================

/**
 * Returns the models cache file path.
 */
export function getModelsCachePath(): string {
  return path.join(getDataDir(), 'models.cache.json')
}

// ============================================================================
// WINDOW STATE
// ============================================================================

/**
 * Returns the window state cache file path.
 */
export function getWindowStateCachePath(): string {
  return path.join(getDataDir(), 'window-state.cache.json')
}
