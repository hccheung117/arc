import type { IpcMain } from 'electron'
import { readFile } from 'node:fs/promises'
import { z } from 'zod'
import type {
  Conversation,
  ConversationPatch,
  ConversationEvent,
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
} from '../lib/conversations'
import { getMessages, createMessage, createBranch, updateMessage } from '../lib/messages'
import { threadIndexFile, type StoredThread } from '../storage'
import {
  installProfile,
  uninstallProfile,
  activateProfile,
  listProfiles,
  getActiveProfileId,
  type ProfileInfo,
  type ProfileInstallResult,
} from '../lib/profiles'
import { fetchAllModels } from '../lib/models'
import { logger } from '../lib/logger'
import { broadcast, validatedArgs, emitModelsEvent, emitProfilesEvent } from '../lib/ipc'

// ============================================================================
// CONVERSATIONS
// ============================================================================

function emitConversationEvent(event: ConversationEvent): void {
  broadcast('arc:conversations:event', event)
}

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

async function handleConversationsUpdate(
  id: string,
  patch: ConversationPatch
): Promise<Conversation> {
  const conversation = await updateConversation(id, patch)
  emitConversationEvent({ type: 'updated', conversation })
  return conversation
}

async function handleConversationsDelete(id: string): Promise<void> {
  await deleteConversation(id)
  emitConversationEvent({ type: 'deleted', id })
}

function registerConversationsHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('arc:conversations:list', handleConversationsList)
  ipcMain.handle(
    'arc:conversations:update',
    validatedArgs(z.tuple([z.string(), ConversationPatchSchema]), handleConversationsUpdate)
  )
  ipcMain.handle(
    'arc:conversations:delete',
    validatedArgs(z.tuple([z.string()]), handleConversationsDelete)
  )
}

// ============================================================================
// MESSAGES
// ============================================================================

async function handleMessagesList(conversationId: string): Promise<ListMessagesResult> {
  return getMessages(conversationId)
}

async function handleMessagesCreate(
  conversationId: string,
  input: CreateMessageInput
): Promise<Message> {
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

async function handleMessagesCreateBranch(
  conversationId: string,
  input: CreateBranchInput
): Promise<CreateBranchResult> {
  return createBranch(
    conversationId,
    input.parentId,
    input.content,
    input.attachments,
    input.modelId,
    input.providerId
  )
}

async function handleMessagesUpdate(
  conversationId: string,
  messageId: string,
  input: UpdateMessageInput
): Promise<Message> {
  return updateMessage(conversationId, messageId, input.content)
}

function registerMessagesHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(
    'arc:messages:list',
    validatedArgs(z.tuple([z.string()]), handleMessagesList)
  )
  ipcMain.handle(
    'arc:messages:create',
    validatedArgs(z.tuple([z.string(), CreateMessageInputSchema]), handleMessagesCreate)
  )
  ipcMain.handle(
    'arc:messages:createBranch',
    validatedArgs(z.tuple([z.string(), CreateBranchInputSchema]), handleMessagesCreateBranch)
  )
  ipcMain.handle(
    'arc:messages:update',
    validatedArgs(z.tuple([z.string(), z.string(), UpdateMessageInputSchema]), handleMessagesUpdate)
  )
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

async function handleProfilesInstall(filePath: string): Promise<ProfileInstallResult> {
  logger.info('profiles', `Install request: ${filePath}`)
  const content = await readFile(filePath, 'utf-8')

  const result = await installProfile(content)
  emitProfilesEvent({ type: 'installed', profile: result })

  await activateProfile(result.id)
  emitProfilesEvent({ type: 'activated', profileId: result.id })

  fetchAllModels()
    .then((updated) => {
      if (updated) emitModelsEvent({ type: 'updated' })
    })
    .catch((err) => logger.error('models', 'Background fetch failed', err as Error))

  return result
}

async function handleProfilesUninstall(profileId: string): Promise<void> {
  await uninstallProfile(profileId)
  emitProfilesEvent({ type: 'uninstalled', profileId })

  fetchAllModels()
    .then((updated) => {
      if (updated) emitModelsEvent({ type: 'updated' })
    })
    .catch((err) => logger.error('models', 'Background fetch failed', err as Error))
}

async function handleProfilesActivate(profileId: string | null): Promise<void> {
  await activateProfile(profileId)
  emitProfilesEvent({ type: 'activated', profileId })

  fetchAllModels()
    .then((updated) => {
      if (updated) emitModelsEvent({ type: 'updated' })
    })
    .catch((err) => logger.error('models', 'Background fetch failed', err as Error))
}

function registerProfilesHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('arc:profiles:list', handleProfilesList)
  ipcMain.handle('arc:profiles:getActive', handleProfilesGetActive)
  ipcMain.handle(
    'arc:profiles:install',
    validatedArgs(z.tuple([z.string()]), handleProfilesInstall)
  )
  ipcMain.handle(
    'arc:profiles:uninstall',
    validatedArgs(z.tuple([z.string()]), handleProfilesUninstall)
  )
  ipcMain.handle(
    'arc:profiles:activate',
    validatedArgs(z.tuple([z.string().nullable()]), handleProfilesActivate)
  )
}

// ============================================================================
// MAIN REGISTRATION
// ============================================================================

export function registerDataHandlers(ipcMain: IpcMain): void {
  registerConversationsHandlers(ipcMain)
  registerMessagesHandlers(ipcMain)
  registerProfilesHandlers(ipcMain)
}
