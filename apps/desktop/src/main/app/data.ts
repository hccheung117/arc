/**
 * Data IPC Handlers
 *
 * Orchestration layer for conversation, message, and profile operations.
 * Composes building blocks from lib/ modules.
 */

import type { IpcMain } from 'electron'
import { readFile } from 'node:fs/promises'
import { z } from 'zod'
import type {
  Conversation,
  ListMessagesResult,
  CreateBranchResult,
} from '@arc-types/arc-api'
import {
  ConversationPatchSchema,
  CreateMessageInputSchema,
  CreateBranchInputSchema,
  UpdateMessageInputSchema,
} from '@arc-types/arc-api'
import type { ConversationSummary } from '@arc-types/conversations'
import type { Message } from '@arc-types/messages'
import {
  getConversationSummaries,
  updateConversation,
  deleteConversation,
  getMessages,
  createMessage,
  createBranch,
  updateMessage,
  toConversation,
  emitConversationEvent,
} from '@main/lib/messages/operations'
import { threadIndexFile } from '@main/lib/messages/storage'
import {
  installProfile,
  uninstallProfile,
  activateProfile,
  listProfiles,
  getActiveProfileId,
  getActiveProfile,
  emitProfilesEvent,
  type ProfileInfo,
  type ProfileInstallResult,
} from '@main/lib/profile/operations'
import { syncModels, emitModelsEvent } from '@main/app/models'
import { info, error } from '@main/foundation/logger'
import { validated } from '@main/foundation/ipc'

// ============================================================================
// CONVERSATIONS
// ============================================================================

async function handleConversationsList(): Promise<ConversationSummary[]> {
  return getConversationSummaries()
}

const handleConversationsUpdate = validated(
  [z.string(), ConversationPatchSchema],
  async (id, patch): Promise<Conversation> => {
    const conversation = await updateConversation(id, patch)
    emitConversationEvent({ type: 'updated', conversation })
    return conversation
  }
)

const handleConversationsDelete = validated([z.string()], async (id) => {
  await deleteConversation(id)
  emitConversationEvent({ type: 'deleted', id })
})

function registerConversationsHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('arc:conversations:list', handleConversationsList)
  ipcMain.handle('arc:conversations:update', handleConversationsUpdate)
  ipcMain.handle('arc:conversations:delete', handleConversationsDelete)
}

// ============================================================================
// MESSAGES
// ============================================================================

const handleMessagesList = validated([z.string()], async (conversationId): Promise<ListMessagesResult> => {
  return getMessages(conversationId)
})

const handleMessagesCreate = validated(
  [z.string(), CreateMessageInputSchema],
  async (conversationId, input): Promise<Message> => {
    const { message, threadWasCreated } = await createMessage(conversationId, input)

    if (threadWasCreated) {
      const index = await threadIndexFile().read()
      const thread = index.threads.find((t) => t.id === conversationId)
      if (thread) {
        emitConversationEvent({
          type: 'created',
          conversation: toConversation(thread),
        })
      }
    }

    return message
  }
)

const handleMessagesCreateBranch = validated(
  [z.string(), CreateBranchInputSchema],
  async (conversationId, input): Promise<CreateBranchResult> => {
    return createBranch(
      conversationId,
      input.parentId,
      input.content,
      input.attachments,
      input.modelId,
      input.providerId
    )
  }
)

const handleMessagesUpdate = validated(
  [z.string(), z.string(), UpdateMessageInputSchema],
  async (conversationId, messageId, input): Promise<Message> => {
    return updateMessage(conversationId, messageId, input.content)
  }
)

function registerMessagesHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('arc:messages:list', handleMessagesList)
  ipcMain.handle('arc:messages:create', handleMessagesCreate)
  ipcMain.handle('arc:messages:createBranch', handleMessagesCreateBranch)
  ipcMain.handle('arc:messages:update', handleMessagesUpdate)
}

// ============================================================================
// PROFILES
// ============================================================================

/**
 * Refreshes the model cache after profile changes.
 * Background operation - errors are logged but not thrown.
 */
async function refreshModelsCache(): Promise<void> {
  try {
    const profile = await getActiveProfile()
    const updated = await syncModels(profile)
    if (updated) emitModelsEvent({ type: 'updated' })
  } catch (err) {
    error('models', 'Background fetch failed', err as Error)
  }
}

async function handleProfilesList(): Promise<ProfileInfo[]> {
  return listProfiles()
}

async function handleProfilesGetActive(): Promise<string | null> {
  return getActiveProfileId()
}

const handleProfilesInstall = validated([z.string()], async (filePath): Promise<ProfileInstallResult> => {
  info('profiles', `Install request: ${filePath}`)
  const content = await readFile(filePath, 'utf-8')

  const result = await installProfile(content)
  emitProfilesEvent({ type: 'installed', profile: result })

  await activateProfile(result.id)
  emitProfilesEvent({ type: 'activated', profileId: result.id })

  // Background model fetch after activation
  refreshModelsCache()

  return result
})

const handleProfilesUninstall = validated([z.string()], async (profileId) => {
  await uninstallProfile(profileId)
  emitProfilesEvent({ type: 'uninstalled', profileId })

  // Background model fetch after uninstall
  refreshModelsCache()
})

const handleProfilesActivate = validated([z.string().nullable()], async (profileId) => {
  await activateProfile(profileId)
  emitProfilesEvent({ type: 'activated', profileId })

  // Background model fetch after activation
  refreshModelsCache()
})

function registerProfilesHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('arc:profiles:list', handleProfilesList)
  ipcMain.handle('arc:profiles:getActive', handleProfilesGetActive)
  ipcMain.handle('arc:profiles:install', handleProfilesInstall)
  ipcMain.handle('arc:profiles:uninstall', handleProfilesUninstall)
  ipcMain.handle('arc:profiles:activate', handleProfilesActivate)
}

// ============================================================================
// MAIN REGISTRATION
// ============================================================================

export function registerDataHandlers(ipcMain: IpcMain): void {
  registerConversationsHandlers(ipcMain)
  registerMessagesHandlers(ipcMain)
  registerProfilesHandlers(ipcMain)
}
