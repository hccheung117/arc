/**
 * App Lifecycle Orchestration
 *
 * Startup initialization and file handling.
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import {
  installProfile,
  activateProfile,
  getActiveProfile,
  emitProfilesEvent,
  generateProviderId,
} from '@main/lib/profile/operations'
import { syncModels } from '@main/lib/models/sync'
import { OPENAI_BASE_URL } from '@main/lib/ai/types'
import { broadcast } from '@main/foundation/ipc'
import { info, error } from '@main/foundation/logger'

/**
 * Initialize models on app startup.
 * Orchestrates: profile → models
 */
export async function initModels(): Promise<void> {
  try {
    const profile = await getActiveProfile()
    const providers = profile?.providers.map((p) => ({
      id: generateProviderId(p),
      baseUrl: p.baseUrl ?? OPENAI_BASE_URL,
      apiKey: p.apiKey ?? null,
      filter: p.modelFilter ?? null,
      aliases: p.modelAliases ?? null,
      name: profile.name,
    })) ?? []
    const updated = await syncModels(providers)
    if (updated) broadcast('arc:models:event', { type: 'updated' })
  } catch (err) {
    error('models', 'Startup fetch failed', err as Error)
  }
}

/**
 * Handle .arc file opened via dock drop or file association.
 * Orchestrates: install → activate → fetch models
 */
export async function handleProfileFileOpen(filePath: string): Promise<void> {
  if (path.extname(filePath).toLowerCase() !== '.arc') {
    return
  }

  info('profiles', `File open: ${filePath}`)

  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const result = await installProfile(content)
    emitProfilesEvent({ type: 'installed', profile: result })

    await activateProfile(result.id)
    emitProfilesEvent({ type: 'activated', profileId: result.id })

    // Background model fetch after activation
    const profile = await getActiveProfile()
    const providers = profile?.providers.map((p) => ({
      id: generateProviderId(p),
      baseUrl: p.baseUrl ?? OPENAI_BASE_URL,
      apiKey: p.apiKey ?? null,
      filter: p.modelFilter ?? null,
      aliases: p.modelAliases ?? null,
      name: profile.name,
    })) ?? []
    syncModels(providers)
      .then((updated) => {
        if (updated) broadcast('arc:models:event', { type: 'updated' })
      })
      .catch((err) => error('models', 'Background fetch failed', err as Error))
  } catch (err) {
    error('profiles', 'File open failed', err as Error)
  }
}
