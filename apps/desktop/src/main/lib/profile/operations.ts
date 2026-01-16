/**
 * Profile & Provider Management
 *
 * Handles installation, activation, and removal of arc profiles.
 * Profiles are complete, isolated provider configurations.
 * Only one profile can be active at a time.
 *
 * Storage: profiles/{id}/ - Extracted archives containing arc.json + optional personas/
 * Arc files are self-describing with embedded id and name.
 */

import * as fs from 'fs/promises'
import { createHash } from 'crypto'
import {
  settingsStorage,
  arcFileParser,
  type StoredFavorite,
  type ArcFile,
} from '@boundary/profiles'
import { info } from '@main/foundation/logger'
import {
  getProfilesDir,
  getProfileDir,
  getProfileArcJsonPath,
} from '@main/foundation/paths'
import { extractArchive } from '@main/foundation/archive'

// ============================================================================
// PROVIDER ID GENERATION
// ============================================================================

/**
 * Generates a stable provider ID from provider properties.
 * SHA-256 hash of type|apiKey|baseUrl ensures same config = same ID.
 */
export function generateProviderId(provider: {
  type: string
  apiKey?: string | null
  baseUrl?: string | null
}) {
  const input = `${provider.type}|${provider.apiKey ?? ''}|${provider.baseUrl ?? ''}`
  return createHash('sha256').update(input).digest('hex').slice(0, 8)
}

// ============================================================================
// PROFILE MANAGEMENT
// ============================================================================

/**
 * Install a profile from a .arc archive file path.
 * Extracts the archive to profiles/{id}/ directory.
 * Overwrites if a profile with the same id already exists (idempotent).
 */
export async function installProfile(archivePath: string) {
  await fs.mkdir(getProfilesDir(), { recursive: true })

  // Extract to a temp directory first, then read arc.json to get the ID
  const tempDir = `${getProfilesDir()}/.installing-${Date.now()}`
  try {
    await extractArchive(archivePath, tempDir)

    // Read and validate arc.json
    const arcJsonPath = `${tempDir}/arc.json`
    let arcJsonContent: string
    try {
      arcJsonContent = await fs.readFile(arcJsonPath, 'utf-8')
    } catch {
      throw new Error('Invalid archive: missing arc.json')
    }

    const validation = arcFileParser.validate(arcJsonContent)
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid arc.json')
    }

    const arcFile = validation.data as ArcFile
    const targetDir = getProfileDir(arcFile.id)

    // Remove existing profile if present
    await fs.rm(targetDir, { recursive: true, force: true })

    // Move temp to final location
    await fs.rename(tempDir, targetDir)

    info('profiles', `Installed: ${arcFile.name} (${arcFile.id})`)

    return {
      id: arcFile.id,
      name: arcFile.name,
      providerCount: arcFile.providers.length,
    }
  } catch (error) {
    // Clean up temp directory on failure
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
    throw error
  }
}

/**
 * Uninstall a profile by id.
 * Removes from disk. Clears activeProfileId if this was active.
 */
export async function uninstallProfile(profileId: string) {
  await fs.rm(getProfileDir(profileId), { recursive: true, force: true })

  await settingsStorage.update((settings) => ({
    ...settings,
    activeProfileId: settings.activeProfileId === profileId ? null : settings.activeProfileId,
  }))

  info('profiles', `Uninstalled: ${profileId}`)
}

/**
 * Activate a profile (or deactivate if null).
 */
export async function activateProfile(profileId: string | null) {
  if (profileId) {
    // Verify profile exists
    const profiles = await listProfiles()
    const exists = profiles.some((p) => p.id === profileId)
    if (!exists) {
      throw new Error(`Profile ${profileId} not found`)
    }
  }

  await settingsStorage.update((settings) => ({
    ...settings,
    activeProfileId: profileId,
  }))

  info('profiles', `Activated: ${profileId ?? 'none'}`)
}

/**
 * Read the active profile's arc.json file.
 * Returns null if no profile is active or file is missing/invalid.
 */
export async function getActiveProfile() {
  const settings = await settingsStorage.read()
  if (!settings.activeProfileId) return null
  return arcFileParser.read(settings.activeProfileId)
}

/**
 * Get active profile ID.
 */
export async function getActiveProfileId() {
  const settings = await settingsStorage.read()
  return settings.activeProfileId
}

/**
 * List all installed profiles by scanning the profiles directory.
 * Reads arc.json from each profile directory to get metadata.
 */
export async function listProfiles() {
  const profilesDir = getProfilesDir()

  let entries: string[]
  try {
    entries = await fs.readdir(profilesDir)
  } catch {
    return []
  }

  const profiles: Array<{ id: string; name: string; providerCount: number }> = []

  for (const entry of entries) {
    // Skip temp directories
    if (entry.startsWith('.')) continue

    const arcJsonPath = getProfileArcJsonPath(entry)
    try {
      const content = await fs.readFile(arcJsonPath, 'utf-8')
      const validation = arcFileParser.validate(content)
      if (validation.valid && validation.data) {
        const data = validation.data as ArcFile
        profiles.push({
          id: data.id,
          name: data.name,
          providerCount: data.providers.length,
        })
      }
    } catch {
      // Skip invalid profiles
    }
  }

  return profiles
}

// ============================================================================
// PROVIDER CONFIG
// ============================================================================

/**
 * Get provider config from active profile by stable content-based ID.
 */
export async function getProviderConfig(providerId: string) {
  const profile = await getActiveProfile()
  if (!profile) {
    throw new Error('No active profile')
  }

  const provider = profile.providers.find((p) => generateProviderId(p) === providerId)
  if (!provider) {
    throw new Error(`Provider ${providerId} not found in active profile`)
  }

  return {
    type: provider.type,
    apiKey: provider.apiKey ?? null,
    baseUrl: provider.baseUrl ?? null,
  }
}

/**
 * Generic settings get handler.
 * Routes key patterns to appropriate sources.
 */
export async function getSetting<T = unknown>(key: string) {
  if (key.startsWith('provider:')) {
    const providerId = key.slice('provider:'.length)
    const config = await getProviderConfig(providerId)
    return config as T
  }

  if (key === 'favorites') {
    const settings = await settingsStorage.read()
    return (settings.favorites ?? []) as T
  }

  return null
}

/**
 * Generic settings set handler.
 * Routes key patterns to appropriate updaters.
 * Note: Provider configs are read-only (come from arc files).
 */
export async function setSetting<T = unknown>(key: string, value: T) {
  if (key.startsWith('provider:')) {
    throw new Error('Provider configs are read-only (managed via arc files)')
  }

  if (key === 'favorites') {
    const favorites = value as StoredFavorite[]
    await settingsStorage.update((settings) => ({
      ...settings,
      favorites,
    }))
  }
}
