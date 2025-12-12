/**
 * Profile Manager
 *
 * Handles installation, activation, and removal of arc profiles.
 * Profiles are complete, isolated provider configurations.
 * Only one profile can be active at a time.
 *
 * Storage: profiles/{id}.arc - Arc files are copied here on import.
 * Arc files are self-describing with embedded id and name.
 */

import { app } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'
import writeFileAtomic from 'write-file-atomic'
import { settingsFile } from '@main/storage'
import { validateArcFile } from './arc-import'
import type { ArcFile, ProfileInfo, ProfileInstallResult } from '@arc-types/arc-file'
import { logger } from './logger'
import { fetchAllModels } from './models'
import { emitProfilesEvent, emitModelsEvent } from './ipc'

export type { ProfileInfo, ProfileInstallResult }

function getProfilesDir(): string {
  return path.join(app.getPath('userData'), 'arcfs', 'profiles')
}

function getProfilePath(profileId: string): string {
  return path.join(getProfilesDir(), `${profileId}.arc`)
}

/**
 * Install a profile from file content.
 * Copies the arc file to profiles directory using its embedded id.
 * Overwrites if a profile with the same id already exists (idempotent).
 */
export async function installProfile(content: string): Promise<ProfileInstallResult> {
  const validation = validateArcFile(content)
  if (!validation.valid || !validation.data) {
    throw new Error(validation.error || 'Invalid arc file')
  }

  const arcFile = validation.data

  await fs.mkdir(getProfilesDir(), { recursive: true })

  await writeFileAtomic(getProfilePath(arcFile.id), content, { encoding: 'utf-8' })

  logger.info('profiles', `Installed: ${arcFile.name} (${arcFile.id})`)

  return {
    id: arcFile.id,
    name: arcFile.name,
    providerCount: arcFile.providers.length,
  }
}

/**
 * Uninstall a profile by id.
 * Removes from disk. Clears activeProfileId if this was active.
 */
export async function uninstallProfile(profileId: string): Promise<void> {
  try {
    await fs.unlink(getProfilePath(profileId))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }

  await settingsFile().update((settings) => ({
    ...settings,
    activeProfileId: settings.activeProfileId === profileId ? null : settings.activeProfileId,
  }))

  logger.info('profiles', `Uninstalled: ${profileId}`)
}

/**
 * Activate a profile (or deactivate if null).
 */
export async function activateProfile(profileId: string | null): Promise<void> {
  if (profileId) {
    // Verify profile exists
    const profiles = await listProfiles()
    const exists = profiles.some((p) => p.id === profileId)
    if (!exists) {
      throw new Error(`Profile ${profileId} not found`)
    }
  }

  await settingsFile().update((settings) => ({
    ...settings,
    activeProfileId: profileId,
  }))

  logger.info('profiles', `Activated: ${profileId ?? 'none'}`)
}

/**
 * Read the active profile's arc file.
 * Returns null if no profile is active or file is missing/invalid.
 */
export async function getActiveProfile(): Promise<ArcFile | null> {
  const settings = await settingsFile().read()
  if (!settings.activeProfileId) return null

  try {
    const content = await fs.readFile(getProfilePath(settings.activeProfileId), 'utf-8')
    const validation = validateArcFile(content)
    return validation.data || null
  } catch {
    return null
  }
}

/**
 * Get active profile ID.
 */
export async function getActiveProfileId(): Promise<string | null> {
  const settings = await settingsFile().read()
  return settings.activeProfileId
}

/**
 * List all installed profiles by scanning the profiles directory.
 * Arc files are the source of truth - we parse each to get metadata.
 */
export async function listProfiles(): Promise<ProfileInfo[]> {
  const profilesDir = getProfilesDir()

  let files: string[]
  try {
    files = await fs.readdir(profilesDir)
  } catch {
    return []
  }

  const profiles: ProfileInfo[] = []

  for (const file of files) {
    if (!file.endsWith('.arc')) continue

    try {
      const content = await fs.readFile(path.join(profilesDir, file), 'utf-8')
      const validation = validateArcFile(content)
      if (validation.valid && validation.data) {
        profiles.push({
          id: validation.data.id,
          name: validation.data.name,
          providerCount: validation.data.providers.length,
        })
      }
    } catch {
      // Skip invalid files
    }
  }

  return profiles
}

/**
 * Handle .arc file opened via dock drop or file association.
 * Installs, activates, and triggers model refresh.
 */
export async function handleProfileFileOpen(filePath: string): Promise<void> {
  if (path.extname(filePath).toLowerCase() !== '.arc') {
    return
  }

  logger.info('profiles', `File open: ${filePath}`)

  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const result = await installProfile(content)
    emitProfilesEvent({ type: 'installed', profile: result })

    await activateProfile(result.id)
    emitProfilesEvent({ type: 'activated', profileId: result.id })

    // Background model fetch after activation
    fetchAllModels()
      .then((updated) => {
        if (updated) emitModelsEvent({ type: 'updated' })
      })
      .catch((err) => logger.error('models', 'Background fetch failed', err as Error))
  } catch (error) {
    logger.error('profiles', 'File open failed', error as Error)
  }
}
