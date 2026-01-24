/**
 * Profile IPC Handlers
 *
 * Orchestration layer for profile management.
 */

import type { IpcMain } from 'electron'
import {
  installProfile,
  uninstallProfile,
  activateProfile,
  listProfiles,
  getActiveProfileId,
  getActiveProfile,
  getProviderConfig,
  generateProviderId,
  mergeFavoriteModels,
} from '@main/lib/profile/operations'
import type { ProfilesEvent } from '@contracts/events'
import { syncModels } from '@main/lib/profile/models'
import { info } from '@main/foundation/logger'
import { broadcast, registerHandlers } from '@main/kernel/ipc'
import { profilesContract } from '@contracts/profiles'

// ============================================================================
// PROFILES HELPER
// ============================================================================

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

const emitProfile = (event: ProfilesEvent) => broadcast<ProfilesEvent>('arc:profiles:event', event)

// ============================================================================
// REGISTRATION
// ============================================================================

export function registerProfileHandlers(ipcMain: IpcMain): void {
  registerHandlers(ipcMain, profilesContract, {
    list: async () => listProfiles(),

    getActive: async () => getActiveProfileId(),

    install: async ({ filePath }) => {
      info('profiles', `Install request: ${filePath}`)
      const result = await installProfile(filePath)

      await activateProfile(result.id)
      await syncProfileModels()
      await mergeFavoriteModels()

      emitProfile({ type: 'installed', profile: result })
      emitProfile({ type: 'activated', profileId: result.id })

      return result
    },

    uninstall: async ({ profileId }) => {
      await uninstallProfile(profileId)
      await syncProfileModels()
      emitProfile({ type: 'uninstalled', profileId })
    },

    activate: async ({ profileId }) => {
      await activateProfile(profileId)
      await syncProfileModels()
      await mergeFavoriteModels()
      emitProfile({ type: 'activated', profileId })
    },

    getActiveDetails: async () => {
      const profile = await getActiveProfile()
      if (!profile) return null
      return {
        id: profile.id,
        name: profile.name,
        modelAssignments: profile.modelAssignments,
      }
    },

    getProviderConfig: async ({ providerId }) => getProviderConfig(providerId),
  })
}
