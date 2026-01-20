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
} from '@main/lib/profile/operations'
import type { ProfilesEvent } from '@contracts/events'
import { syncModels } from '@main/lib/profile/models'
import { initAutoUpdate } from '@main/modules/updater/business'
import { createUpdaterLogger } from '@main/modules/updater/logger'
import { broadcast } from '@main/kernel/ipc'
import { info, error, createLogger } from '@main/foundation/logger'

const updaterLogger = createUpdaterLogger(createLogger('updater'))

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
  initAutoUpdate(updaterLogger)(profile?.updateInterval)
}
