import type { IpcMain, IpcMainInvokeEvent } from 'electron'
import { BrowserWindow } from 'electron'
import { randomUUID } from 'crypto'
import type {
  Conversation,
  ConversationPatch,
  ConversationEvent,
  AIStreamEvent,
  CreateMessageInput,
  ChatOptions,
  ChatResponse,
} from '../types/arc-api'
import type { ConversationSummary, ContextMenuAction } from '../types/conversations'
import type { Message } from '../types/messages'
import type { Model } from '../types/models'
import {
  getConversationSummaries,
  updateConversation,
  ensureConversation,
  deleteConversation,
} from './lib/conversations'
import { getMessages, createMessage } from './lib/messages'
import { getModels } from './lib/models'
import { startChatStream, cancelStream } from './lib/ai'
import { getConfig, setConfig } from './lib/providers'
import { showThreadContextMenu } from './lib/ui'

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
 * Ensures a conversation exists and emits 'created' event if newly created.
 * Used internally by message handlers.
 */
export async function ensureConversationAndEmit(conversationId: string): Promise<Conversation> {
  const { conversation, wasCreated } = await ensureConversation(conversationId)
  if (wasCreated) {
    emitConversationEvent({ type: 'created', conversation })
  }
  return conversation
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
  conversationId: string
): Promise<Message[]> {
  return getMessages(conversationId)
}

async function handleMessagesCreate(
  _event: IpcMainInvokeEvent,
  conversationId: string,
  input: CreateMessageInput
): Promise<Message> {
  await ensureConversationAndEmit(conversationId)
  return createMessage(conversationId, input)
}

export function registerMessagesHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('arc:messages:list', handleMessagesList)
  ipcMain.handle('arc:messages:create', handleMessagesCreate)
}

// ============================================================================
// MODELS HANDLERS
// ============================================================================

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
  const streamId = randomUUID()

  startChatStream(streamId, conversationId, options.model, {
    onDelta: (chunk) => emitAIStreamEvent({ type: 'delta', streamId, chunk }),
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

export function registerUIHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('arc:ui:showThreadContextMenu', handleUIShowThreadContextMenu)
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
}
