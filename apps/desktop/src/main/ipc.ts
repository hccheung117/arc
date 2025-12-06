import type { IpcMain, IpcMainInvokeEvent } from 'electron'
import { BrowserWindow, shell } from 'electron'
import { createId } from '@paralleldrive/cuid2'
import { readFile } from 'node:fs/promises'
import type {
  Conversation,
  ConversationPatch,
  ConversationEvent,
  AIStreamEvent,
  CreateMessageInput,
  CreateBranchInput,
  ListMessagesResult,
  CreateBranchResult,
  SwitchBranchResult,
  ChatOptions,
  ChatResponse,
} from '@arc-types/arc-api'
import type { ArcImportEvent } from '@arc-types/arc-file'
import type { ConversationSummary, ContextMenuAction } from '@arc-types/conversations'
import type { Message, MessageContextMenuAction } from '@arc-types/messages'
import type { Model } from '@arc-types/models'
import {
  getConversationSummaries,
  updateConversation,
  deleteConversation,
} from './lib/conversations'
import { getMessages, createMessage, createBranch, switchBranch } from './lib/messages'
import { getModels, fetchAllModels } from './lib/models'
import { startChatStream, cancelStream } from './lib/ai'
import { getConfig, setConfig } from './lib/providers'
import { threadIndexFile, type StoredThread } from './storage'
import { showThreadContextMenu, showMessageContextMenu } from './lib/ui'
import {
  installProfile,
  uninstallProfile,
  activateProfile,
  listProfiles,
  getActiveProfileId,
  type ProfileInfo,
  type ProfileInstallResult,
} from './lib/profiles'
import { getAttachmentPath } from './lib/attachments'

/**
 * Arc IPC Handlers
 *
 * Pure registry: handlers decode requests, delegate to lib functions, emit events.
 * All business logic lives in ./lib modules.
 */

// ============================================================================
// BROADCAST UTILITIES
// ============================================================================

function broadcast<T>(channel: string, data: T): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(channel, data)
  }
}

function emitConversationEvent(event: ConversationEvent): void {
  broadcast('arc:conversations:event', event)
}

export function emitAIStreamEvent(event: AIStreamEvent): void {
  broadcast('arc:ai:event', event)
}

// ============================================================================
// CONVERSATIONS HANDLERS
// ============================================================================

async function handleConversationsList(): Promise<ConversationSummary[]> {
  return getConversationSummaries()
}

async function handleConversationsUpdate(
  _event: IpcMainInvokeEvent,
  id: string,
  patch: ConversationPatch
): Promise<Conversation> {
  const conversation = await updateConversation(id, patch)
  emitConversationEvent({ type: 'updated', conversation })
  return conversation
}

async function handleConversationsDelete(_event: IpcMainInvokeEvent, id: string): Promise<void> {
  await deleteConversation(id)
  emitConversationEvent({ type: 'deleted', id })
}

/**
 * Helper to convert a StoredThread to a Conversation for event emission.
 */
function storedThreadToConversation(thread: StoredThread): Conversation {
  return {
    id: thread.id,
    title: thread.title ?? 'New Chat',
    pinned: thread.pinned,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
  }
}

export function registerConversationsHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('arc:conversations:list', handleConversationsList)
  ipcMain.handle('arc:conversations:update', handleConversationsUpdate)
  ipcMain.handle('arc:conversations:delete', handleConversationsDelete)
}

// ============================================================================
// MESSAGES HANDLERS
// ============================================================================

async function handleMessagesList(
  _event: IpcMainInvokeEvent,
  conversationId: string,
): Promise<ListMessagesResult> {
  return getMessages(conversationId)
}

async function handleMessagesCreate(
  _event: IpcMainInvokeEvent,
  conversationId: string,
  input: CreateMessageInput,
): Promise<Message> {
  const { message, threadWasCreated } = await createMessage(conversationId, input)

  // Emit 'created' event if this is a new thread
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
  _event: IpcMainInvokeEvent,
  conversationId: string,
  input: CreateBranchInput,
): Promise<CreateBranchResult> {
  return createBranch(
    conversationId,
    input.parentId,
    input.content,
    input.attachments,
    input.modelId,
    input.providerId,
  )
}

async function handleMessagesSwitchBranch(
  _event: IpcMainInvokeEvent,
  conversationId: string,
  branchParentId: string | null,
  targetBranchIndex: number,
): Promise<SwitchBranchResult> {
  return switchBranch(conversationId, branchParentId, targetBranchIndex)
}

export function registerMessagesHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('arc:messages:list', handleMessagesList)
  ipcMain.handle('arc:messages:create', handleMessagesCreate)
  ipcMain.handle('arc:messages:createBranch', handleMessagesCreateBranch)
  ipcMain.handle('arc:messages:switchBranch', handleMessagesSwitchBranch)
}

// ============================================================================
// MODELS HANDLERS
// ============================================================================

export type ModelsEvent = { type: 'updated' }

export function emitModelsEvent(event: ModelsEvent): void {
  broadcast('arc:models:event', event)
}

async function handleModelsList(): Promise<Model[]> {
  return getModels()
}

export function registerModelsHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('arc:models:list', handleModelsList)
}

// ============================================================================
// AI HANDLERS
// ============================================================================

async function handleAIChat(
  _event: IpcMainInvokeEvent,
  conversationId: string,
  options: ChatOptions
): Promise<ChatResponse> {
  const streamId = createId()

  startChatStream(streamId, conversationId, options.model, {
    onDelta: (chunk) => emitAIStreamEvent({ type: 'delta', streamId, chunk }),
    onReasoning: (chunk) => emitAIStreamEvent({ type: 'reasoning', streamId, chunk }),
    onComplete: (message) => emitAIStreamEvent({ type: 'complete', streamId, message }),
    onError: (error) => emitAIStreamEvent({ type: 'error', streamId, error }),
  }).catch((error) => {
    const errorMsg = error instanceof Error ? error.message : 'Unknown streaming error'
    console.error(`[arc:ai:chat] Error: ${errorMsg}`)
    emitAIStreamEvent({ type: 'error', streamId, error: errorMsg })
  })

  return { streamId }
}

async function handleAIStop(_event: IpcMainInvokeEvent, streamId: string): Promise<void> {
  cancelStream(streamId)
}

export function registerAIHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('arc:ai:chat', handleAIChat)
  ipcMain.handle('arc:ai:stop', handleAIStop)
}

// ============================================================================
// CONFIG HANDLERS
// ============================================================================

async function handleConfigGet<T = unknown>(
  _event: IpcMainInvokeEvent,
  key: string
): Promise<T | null> {
  return getConfig<T>(key)
}

async function handleConfigSet<T = unknown>(
  _event: IpcMainInvokeEvent,
  key: string,
  value: T
): Promise<void> {
  await setConfig(key, value)
}

export function registerConfigHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('arc:config:get', handleConfigGet)
  ipcMain.handle('arc:config:set', handleConfigSet)
}

// ============================================================================
// UI HANDLERS
// ============================================================================

async function handleUIShowThreadContextMenu(
  _event: IpcMainInvokeEvent,
  isPinned: boolean
): Promise<ContextMenuAction> {
  return showThreadContextMenu(isPinned)
}

async function handleUIShowMessageContextMenu(
  _event: IpcMainInvokeEvent,
  content: string,
  hasEditOption: boolean
): Promise<MessageContextMenuAction> {
  return showMessageContextMenu(content, hasEditOption)
}

export function registerUIHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('arc:ui:showThreadContextMenu', handleUIShowThreadContextMenu)
  ipcMain.handle('arc:ui:showMessageContextMenu', handleUIShowMessageContextMenu)
}

// ============================================================================
// PROFILES HANDLERS
// ============================================================================

export type ProfilesEvent =
  | { type: 'installed'; profile: ProfileInstallResult }
  | { type: 'uninstalled'; profileId: string }
  | { type: 'activated'; profileId: string | null }

export function emitProfilesEvent(event: ProfilesEvent): void {
  broadcast('arc:profiles:event', event)
}

async function handleProfilesList(): Promise<ProfileInfo[]> {
  return listProfiles()
}

async function handleProfilesGetActive(): Promise<string | null> {
  return getActiveProfileId()
}

async function handleProfilesInstall(
  _event: IpcMainInvokeEvent,
  filePath: string
): Promise<ProfileInstallResult> {
  console.log(`[arc:profiles] Install request: ${filePath}`)
  const content = await readFile(filePath, 'utf-8')

  const result = await installProfile(content)
  emitProfilesEvent({ type: 'installed', profile: result })

  // Auto-activate the installed profile
  await activateProfile(result.id)
  emitProfilesEvent({ type: 'activated', profileId: result.id })

  // Trigger background model fetch after activation
  fetchAllModels()
    .then((updated) => {
      if (updated) emitModelsEvent({ type: 'updated' })
    })
    .catch((err) => console.error('[models] Background fetch failed:', err))

  return result
}

async function handleProfilesUninstall(
  _event: IpcMainInvokeEvent,
  profileId: string
): Promise<void> {
  await uninstallProfile(profileId)
  emitProfilesEvent({ type: 'uninstalled', profileId })

  // Trigger model refresh (may now be empty if this was active)
  fetchAllModels()
    .then((updated) => {
      if (updated) emitModelsEvent({ type: 'updated' })
    })
    .catch((err) => console.error('[models] Background fetch failed:', err))
}

async function handleProfilesActivate(
  _event: IpcMainInvokeEvent,
  profileId: string | null
): Promise<void> {
  await activateProfile(profileId)
  emitProfilesEvent({ type: 'activated', profileId })

  // Trigger model refresh after activation
  fetchAllModels()
    .then((updated) => {
      if (updated) emitModelsEvent({ type: 'updated' })
    })
    .catch((err) => console.error('[models] Background fetch failed:', err))
}

export function registerProfilesHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('arc:profiles:list', handleProfilesList)
  ipcMain.handle('arc:profiles:getActive', handleProfilesGetActive)
  ipcMain.handle('arc:profiles:install', handleProfilesInstall)
  ipcMain.handle('arc:profiles:uninstall', handleProfilesUninstall)
  ipcMain.handle('arc:profiles:activate', handleProfilesActivate)
}

// ============================================================================
// IMPORT HANDLERS (Legacy - redirects to profiles)
// ============================================================================

export function emitImportEvent(event: ArcImportEvent): void {
  broadcast('arc:import:event', event)
}

async function handleImportFile(
  _event: IpcMainInvokeEvent,
  filePath: string
): Promise<ProfileInstallResult> {
  // Redirect to profile install
  return handleProfilesInstall(_event, filePath)
}

export function registerImportHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('arc:import:file', handleImportFile)
}

// ============================================================================
// UTILS HANDLERS
// ============================================================================

async function handleUtilsOpenFile(
  _event: IpcMainInvokeEvent,
  filePath: string
): Promise<void> {
  await shell.openPath(filePath)
}

async function handleUtilsGetAttachmentPath(
  _event: IpcMainInvokeEvent,
  conversationId: string,
  relativePath: string
): Promise<string> {
  return getAttachmentPath(conversationId, relativePath)
}

export function registerUtilsHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('arc:utils:openFile', handleUtilsOpenFile)
  ipcMain.handle('arc:utils:getAttachmentPath', handleUtilsGetAttachmentPath)
}

// ============================================================================
// MAIN REGISTRATION
// ============================================================================

export function registerArcHandlers(ipcMain: IpcMain): void {
  registerConversationsHandlers(ipcMain)
  registerMessagesHandlers(ipcMain)
  registerModelsHandlers(ipcMain)
  registerAIHandlers(ipcMain)
  registerConfigHandlers(ipcMain)
  registerUIHandlers(ipcMain)
  registerProfilesHandlers(ipcMain)
  registerImportHandlers(ipcMain)
  registerUtilsHandlers(ipcMain)
}
