/**
 * Path Management
 *
 * Platform-agnostic path construction for the arcfs data layer.
 * SOLE OWNER of all on-disk layout decisions within ArcFS.
 * Directory names, file names, extensions, and path structures are defined here
 * and nowhere else.
 *
 * Two-Layer Architecture:
 * - profiles/ : Distributed truth (read-only, from .arc archives)
 * - app/      : User data (read-write, extensions and overwrites)
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
export function getDataDir() {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, 'arcfs')
}

// ============================================================================
// APP (User Data Layer)
// ============================================================================

/**
 * Returns the app directory path (user data root).
 * All user-modifiable data lives here.
 */
export function getAppDir() {
  return path.join(getDataDir(), 'app')
}

/**
 * Returns the settings file path.
 * Global settings: activeProfileId, favorites.
 */
export function getSettingsPath() {
  return path.join(getAppDir(), 'settings.json')
}

/**
 * Returns the cache directory path.
 * Contains rebuildable data.
 */
export function getCacheDir() {
  return path.join(getAppDir(), 'cache')
}

/**
 * Returns the models cache file path.
 */
export function getModelsCachePath() {
  return path.join(getCacheDir(), 'models.cache.json')
}

/**
 * Returns the window state cache file path.
 */
export function getWindowStateCachePath() {
  return path.join(getCacheDir(), 'window-state.cache.json')
}

// ============================================================================
// APP / PERSONAS
// ============================================================================

/**
 * Returns the app personas directory path.
 * User-created personas that can shadow profile personas.
 */
export function getAppPersonasDir() {
  return path.join(getAppDir(), 'personas')
}

/**
 * Returns the directory path for a user persona.
 */
export function getAppPersonaDir(name: string) {
  return path.join(getAppPersonasDir(), name)
}

/**
 * Returns the PERSONA.md file path for a user persona.
 */
export function getAppPersonaPath(name: string) {
  return path.join(getAppPersonaDir(name), 'PERSONA.md')
}

// ============================================================================
// APP / MESSAGES
// ============================================================================

/**
 * Returns the messages directory path.
 * Contains thread logs (.jsonl) and attachment subdirectories.
 */
export function getMessagesDir() {
  return path.join(getAppDir(), 'messages')
}

/**
 * Returns the absolute path to a thread's attachment directory.
 */
export function getThreadAttachmentsDir(threadId: string) {
  return path.join(getMessagesDir(), threadId)
}

/**
 * Returns the absolute file path for an attachment.
 */
export function getThreadAttachmentPath(threadId: string, relativePath: string) {
  return path.join(getThreadAttachmentsDir(threadId), relativePath)
}

/**
 * Returns the thread index file path.
 */
export function getThreadIndexPath() {
  return path.join(getMessagesDir(), 'index.json')
}

/**
 * Returns the message log file path for a thread.
 */
export function getMessageLogPath(threadId: string) {
  return path.join(getMessagesDir(), `${threadId}.jsonl`)
}

// ============================================================================
// PROFILES (Distributed Truth Layer)
// ============================================================================

/**
 * Returns the profiles directory path.
 * Contains extracted profile archives (read-only).
 */
export function getProfilesDir() {
  return path.join(getDataDir(), 'profiles')
}

/**
 * Returns the directory path for an installed profile.
 */
export function getProfileDir(profileId: string) {
  return path.join(getProfilesDir(), profileId)
}

/**
 * Returns the arc.json file path for an installed profile.
 */
export function getProfileArcJsonPath(profileId: string) {
  return path.join(getProfileDir(profileId), 'arc.json')
}

/**
 * Returns the personas directory path for an installed profile.
 */
export function getProfilePersonasDir(profileId: string) {
  return path.join(getProfileDir(profileId), 'personas')
}

/**
 * Returns the directory path for a profile persona.
 */
export function getProfilePersonaDir(profileId: string, name: string) {
  return path.join(getProfilePersonasDir(profileId), name)
}

/**
 * Returns the PERSONA.md file path for a profile persona.
 */
export function getProfilePersonaPath(profileId: string, name: string) {
  return path.join(getProfilePersonaDir(profileId, name), 'PERSONA.md')
}
