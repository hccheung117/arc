/**
 * App Lifecycle Orchestration
 *
 * Startup initialization and file handling.
 */

import * as path from 'path'
import {
  installProfile,
  activateProfile,
  getActiveProfile,
  generateProviderId,
  mergeFavoriteModels,
  type ProfilesEvent,
} from '@main/lib/profile/operations'
import { syncModels } from '@main/lib/profile/models'
import { initAutoUpdate } from '@main/lib/updater/operations'
import { broadcast } from '@main/foundation/ipc'
import { info, error } from '@main/foundation/logger'

async function syncProfileModels(): Promise<void> {
  const profile = await getActiveProfile()
  const providers =
    profile?.providers.map((p) => ({
      id: generateProviderId(p),
      baseUrl: p.baseUrl,
      apiKey: p.apiKey,
      filter: p.modelFilter,
      aliases: p.modelAliases,
      providerName: profile.name,
    })) ?? []
  await syncModels(providers)
}

/**
 * Handle .arc file opened via dock drop or file association.
 * Emits profile events; renderer refreshes derived data (models, personas).
 */
export async function handleProfileFileOpen(filePath: string): Promise<void> {
  if (path.extname(filePath).toLowerCase() !== '.arc') {
    return
  }

  info('profiles', `File open: ${filePath}`)

  try {
    const result = await installProfile(filePath)

    await activateProfile(result.id)
    await syncProfileModels()
    await mergeFavoriteModels()

    broadcast<ProfilesEvent>('arc:profiles:event', { type: 'installed', profile: result })
    broadcast<ProfilesEvent>('arc:profiles:event', { type: 'activated', profileId: result.id })
  } catch (err) {
    error('profiles', 'File open failed', err as Error)
  }
}

/**
 * Initialize all app systems on startup.
 */
export async function initApp(): Promise<void> {
  const profile = await getActiveProfile()
  initAutoUpdate(profile?.updateInterval)
}
