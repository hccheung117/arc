/**
 * Data IPC Handlers
 *
 * Orchestration layer for messages and profiles.
 * Thread/folder handlers are in app/threads.ts.
 */

import type { IpcMain } from 'electron'
import type { StoredThread } from '@boundary/messages'
import { threadStorage } from '@boundary/messages'
import { appendMessage, readMessages } from '@main/lib/messages/operations'
import {
  installProfile,
  uninstallProfile,
  activateProfile,
  listProfiles,
  getActiveProfileId,
  getActiveProfile,
  generateProviderId,
  type ProfilesEvent,
} from '@main/lib/profile/operations'
import { syncModels } from '@main/lib/profile/models'
import { info } from '@main/foundation/logger'
import { broadcast } from '@main/foundation/ipc'
import { registerHandlers } from '@main/foundation/contract'
import { messagesContract } from '@contracts/messages'
import { profilesContract } from '@contracts/profiles'

// ============================================================================
// THREAD EVENTS (for message creation side effect)
// ============================================================================

type ThreadEvent = { type: 'created'; thread: StoredThread }

function emitThread(event: ThreadEvent): void {
  broadcast('arc:threads:event', event)
}

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

export function registerDataHandlers(ipcMain: IpcMain): void {
  // Messages
  registerHandlers(ipcMain, messagesContract, {
    list: async ({ threadId }) => readMessages(threadId),

    create: async ({ threadId, input }) => {
      const { message, threadCreated } = await appendMessage({
        type: 'new',
        threadId,
        ...input,
      })

      if (threadCreated) {
        const index = await threadStorage.read()
        const thread = index.threads.find((t) => t.id === threadId)
        if (thread) emitThread({ type: 'created', thread })
      }

      return message
    },

    createBranch: async ({ threadId, input }) => {
      const { message } = await appendMessage({
        type: 'new',
        threadId,
        role: 'user',
        content: input.content,
        parentId: input.parentId,
        attachments: input.attachments,
        modelId: input.modelId,
        providerId: input.providerId,
        threadConfig: input.threadConfig,
      })

      const { branchPoints } = await readMessages(threadId)
      return { message, branchPoints }
    },

    update: async ({ threadId, messageId, input }) => {
      const { message } = await appendMessage({
        type: 'edit',
        threadId,
        messageId,
        ...input,
      })
      return message
    },
  })

  // Profiles
  registerHandlers(ipcMain, profilesContract, {
    list: async () => listProfiles(),

    getActive: async () => getActiveProfileId(),

    install: async ({ filePath }) => {
      info('profiles', `Install request: ${filePath}`)
      const result = await installProfile(filePath)

      await activateProfile(result.id)
      await syncProfileModels()

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
      emitProfile({ type: 'activated', profileId })
    },
  })
}
