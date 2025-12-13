import type { IpcMain } from 'electron'
import { readFile } from 'node:fs/promises'
import { z } from 'zod'
import type {
  Conversation,
  ConversationPatch,
  CreateMessageInput,
  CreateBranchInput,
  UpdateMessageInput,
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
} from '../lib/messages'
import { threadIndexFile, type StoredThread } from '../storage'
import {
  installProfile,
  uninstallProfile,
  activateProfile,
  listProfiles,
  getActiveProfileId,
  type ProfileInfo,
  type ProfileInstallResult,
} from '../lib/profile'
import { fetchAllModels, emitModelsEvent } from '../lib/models'
import { info, error } from '../lib/logger'
import { validated } from '../lib/ipc'
import { emitProfilesEvent } from '../lib/profile'
import { emitConversationEvent } from '../lib/messages'

// ============================================================================
// CONVERSATIONS
// ============================================================================

function storedThreadToConversation(thread: StoredThread): Conversation {
  return {
    id: thread.id,
    title: thread.title ?? 'New Chat',
    pinned: thread.pinned,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
  }
}

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
          conversation: storedThreadToConversation(thread),
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

  fetchAllModels()
    .then((updated) => {
      if (updated) emitModelsEvent({ type: 'updated' })
    })
    .catch((err) => error('models', 'Background fetch failed', err as Error))

  return result
})

const handleProfilesUninstall = validated([z.string()], async (profileId) => {
  await uninstallProfile(profileId)
  emitProfilesEvent({ type: 'uninstalled', profileId })

  fetchAllModels()
    .then((updated) => {
      if (updated) emitModelsEvent({ type: 'updated' })
    })
    .catch((err) => error('models', 'Background fetch failed', err as Error))
})

const handleProfilesActivate = validated([z.string().nullable()], async (profileId) => {
  await activateProfile(profileId)
  emitProfilesEvent({ type: 'activated', profileId })

  fetchAllModels()
    .then((updated) => {
      if (updated) emitModelsEvent({ type: 'updated' })
    })
    .catch((err) => error('models', 'Background fetch failed', err as Error))
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
