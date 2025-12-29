/**
 * ArcFS Path Utilities
 *
 * This module is the SOLE OWNER of all on-disk layout decisions within ArcFS.
 * Directory names, file names, extensions, and path structures are defined here
 * and nowhere else. Domain modules import these functions rather than constructing
 * paths directly—ensuring a single source of truth for physical layout.
 *
 * If you need a new path under arcfs/, add it here.
 * If you see path.join(getDataDir(), ...) elsewhere, it belongs here instead.
 */

import * as path from 'path'
import { getDataDir } from '@main/foundation/paths'

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

/**
 * Returns the models cache file path.
 */
export function getModelsCachePath(): string {
  return path.join(getDataDir(), 'models.cache.json')
}
