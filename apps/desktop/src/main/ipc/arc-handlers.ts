import type { IpcMain, IpcMainInvokeEvent } from 'electron'
import { BrowserWindow } from 'electron'
import { db } from '../db/client'
import { conversations, messages } from '../db/schema'
import { eq, asc } from 'drizzle-orm'
import type {
  Conversation,
  ConversationPatch,
  ConversationEvent,
  AIStreamEvent,
  CreateMessageInput,
} from '../../types/arc-api'
import type { ConversationSummary } from '../../types/conversations'
import type { Message } from '../../types/messages'
import { getConversationSummaries } from '../conversations/handlers'

/**
 * Arc IPC Handlers (M3: New API Surface)
 *
 * Resource-based handlers for the new window.arc API.
 * Each resource (conversations, messages, models, ai, config) gets its own
 * namespace following the pattern: arc:{resource}:{operation}
 */

/**
 * Broadcasts an event to all renderer windows.
 * Used for push events (Rule 3) that need to notify all subscribers.
 */
function broadcast<T>(channel: string, data: T): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(channel, data)
  }
}

/**
 * Emits a conversation lifecycle event to all windows.
 */
function emitConversationEvent(event: ConversationEvent): void {
  broadcast('arc:conversations:event', event)
}

/**
 * Emits an AI stream event to all windows.
 */
export function emitAIStreamEvent(event: AIStreamEvent): void {
  broadcast('arc:ai:event', event)
}

/**
 * Converts a database row to a Conversation entity.
 */
function toConversation(row: {
  id: string
  title: string | null
  pinned: boolean | null
  createdAt: Date
  updatedAt: Date
}): Conversation {
  return {
    id: row.id,
    title: row.title ?? 'New Chat',
    pinned: row.pinned ?? false,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/**
 * Lists all conversations (summaries).
 * Reuses existing handler for consistency.
 */
async function handleConversationsList(): Promise<ConversationSummary[]> {
  return getConversationSummaries()
}

/**
 * Updates a conversation with a partial patch.
 * Consolidates rename and togglePin into a single generic update.
 * Emits 'updated' event after successful update.
 */
async function handleConversationsUpdate(
  _event: IpcMainInvokeEvent,
  id: string,
  patch: ConversationPatch
): Promise<Conversation> {
  const updateData: { title?: string; pinned?: boolean; updatedAt: Date } = {
    updatedAt: new Date(),
  }

  if (patch.title !== undefined) {
    updateData.title = patch.title
  }
  if (patch.pinned !== undefined) {
    updateData.pinned = patch.pinned
  }

  await db.update(conversations).set(updateData).where(eq(conversations.id, id))

  const [row] = await db.select().from(conversations).where(eq(conversations.id, id))

  if (!row) {
    throw new Error(`Conversation not found: ${id}`)
  }

  const conversation = toConversation(row)
  emitConversationEvent({ type: 'updated', conversation })

  return conversation
}

/**
 * Deletes a conversation and all its messages.
 * Emits 'deleted' event after successful deletion.
 */
async function handleConversationsDelete(_event: IpcMainInvokeEvent, id: string): Promise<void> {
  await db.delete(messages).where(eq(messages.conversationId, id))
  await db.delete(conversations).where(eq(conversations.id, id))

  emitConversationEvent({ type: 'deleted', id })
}

/**
 * Creates a conversation record and emits 'created' event.
 * Called internally when a message is created for a non-existent conversation.
 */
export async function ensureConversationAndEmit(conversationId: string): Promise<Conversation> {
  const [existing] = await db.select().from(conversations).where(eq(conversations.id, conversationId))

  if (existing) {
    return toConversation(existing)
  }

  const now = new Date()
  await db.insert(conversations).values({
    id: conversationId,
    title: null,
    pinned: false,
    createdAt: now,
    updatedAt: now,
  })

  const [created] = await db.select().from(conversations).where(eq(conversations.id, conversationId))

  if (!created) {
    throw new Error(`Failed to create conversation: ${conversationId}`)
  }

  const conversation = toConversation(created)
  emitConversationEvent({ type: 'created', conversation })

  return conversation
}

/**
 * Registers all arc:conversations:* handlers.
 */
export function registerConversationsHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('arc:conversations:list', handleConversationsList)
  ipcMain.handle('arc:conversations:update', handleConversationsUpdate)
  ipcMain.handle('arc:conversations:delete', handleConversationsDelete)
}

/**
 * Converts a database row to a Message entity.
 */
function toMessage(row: {
  id: string
  conversationId: string
  role: string
  content: string
  createdAt: Date
  updatedAt: Date
}): Message {
  return {
    id: row.id,
    conversationId: row.conversationId,
    role: row.role as 'user' | 'assistant' | 'system',
    status: 'complete',
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/**
 * Lists all messages for a conversation.
 */
async function handleMessagesList(
  _event: IpcMainInvokeEvent,
  conversationId: string
): Promise<Message[]> {
  const result = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt))

  return result.map(toMessage)
}

/**
 * Creates a new message.
 * Auto-creates the conversation if it doesn't exist, emitting 'created' event.
 */
async function handleMessagesCreate(
  _event: IpcMainInvokeEvent,
  conversationId: string,
  input: CreateMessageInput
): Promise<Message> {
  await ensureConversationAndEmit(conversationId)

  const now = new Date()
  const [inserted] = await db
    .insert(messages)
    .values({
      conversationId,
      role: input.role,
      content: input.content,
      createdAt: now,
      updatedAt: now,
    })
    .returning()

  await db
    .update(conversations)
    .set({ updatedAt: now })
    .where(eq(conversations.id, conversationId))

  return toMessage(inserted)
}

/**
 * Registers all arc:messages:* handlers.
 */
export function registerMessagesHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('arc:messages:list', handleMessagesList)
  ipcMain.handle('arc:messages:create', handleMessagesCreate)
}

// ============================================================================
// MODELS HANDLERS
// ============================================================================

import { getModels } from '../models/handlers'
import type { Model } from '../../types/models'

/**
 * Lists all available AI models.
 */
async function handleModelsList(): Promise<Model[]> {
  return getModels()
}

/**
 * Registers all arc:models:* handlers.
 */
export function registerModelsHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('arc:models:list', handleModelsList)
}

// ============================================================================
// AI HANDLERS
// ============================================================================

import { randomUUID } from 'crypto'
import type { ChatOptions, ChatResponse } from '../../types/arc-api'
import { models as modelsTable, providers } from '../db/schema'
import { getProviderConfig } from '../providers/handlers'
import { streamChatCompletion, toCoreMessages, type ProviderConfig } from '../ai/service'

const activeStreams = new Map<string, AbortController>()

/**
 * Get provider ID for a given model.
 */
async function getModelProvider(modelId: string): Promise<string> {
  const result = await db
    .select({ providerId: modelsTable.providerId })
    .from(modelsTable)
    .where(eq(modelsTable.id, modelId))
    .get()

  if (!result) {
    throw new Error(`Model ${modelId} not found`)
  }

  return result.providerId
}

/**
 * Insert assistant message to database.
 */
async function insertAssistantMessage(conversationId: string, content: string): Promise<Message> {
  const now = new Date()
  const [inserted] = await db
    .insert(messages)
    .values({
      conversationId,
      role: 'assistant',
      content,
      createdAt: now,
      updatedAt: now,
    })
    .returning()

  return toMessage(inserted)
}

/**
 * Start AI chat response stream.
 * Assumes user message already created via arc:messages:create.
 * Returns streamId for tracking. Events pushed via arc:ai:event channel.
 */
async function handleAIChat(
  _event: IpcMainInvokeEvent,
  conversationId: string,
  options: ChatOptions
): Promise<ChatResponse> {
  const streamId = randomUUID()

  startAIStreaming(streamId, conversationId, options.model).catch((error) => {
    const errorMsg = error instanceof Error ? error.message : 'Unknown streaming error'
    console.error(`[arc:ai:chat] Error: ${errorMsg}`)
    emitAIStreamEvent({ type: 'error', streamId, error: errorMsg })
  })

  return { streamId }
}

/**
 * Background AI streaming process.
 * Uses broadcast instead of sender.send for unified event handling.
 */
async function startAIStreaming(
  streamId: string,
  conversationId: string,
  modelId: string
): Promise<void> {
  const abortController = new AbortController()
  activeStreams.set(streamId, abortController)

  try {
    const conversationMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.createdAt))

    const messageList: Message[] = conversationMessages.map(toMessage)

    const providerId = await getModelProvider(modelId)
    const config = await getProviderConfig(providerId)
    const provider = await db
      .select({ type: providers.type })
      .from(providers)
      .where(eq(providers.id, providerId))
      .get()

    if (!provider) {
      throw new Error(`Provider ${providerId} not found`)
    }

    const providerConfig: ProviderConfig = {
      type: provider.type,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
    }

    const coreMessages = toCoreMessages(messageList)
    const result = await streamChatCompletion(
      providerConfig,
      modelId,
      coreMessages,
      abortController.signal
    )

    let fullContent = ''

    for await (const textPart of result.textStream) {
      fullContent += textPart
      emitAIStreamEvent({ type: 'delta', streamId, chunk: textPart })
    }

    const assistantMessage = await insertAssistantMessage(conversationId, fullContent)

    await db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, conversationId))

    emitAIStreamEvent({ type: 'complete', streamId, message: assistantMessage })
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      return
    }

    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[arc:ai:chat] Stream error: ${errorMsg}`)
    emitAIStreamEvent({ type: 'error', streamId, error: errorMsg })
  } finally {
    activeStreams.delete(streamId)
  }
}

/**
 * Cancel an active AI stream.
 */
async function handleAIStop(_event: IpcMainInvokeEvent, streamId: string): Promise<void> {
  const controller = activeStreams.get(streamId)
  if (controller) {
    controller.abort()
    activeStreams.delete(streamId)
  }
}

/**
 * Registers all arc:ai:* handlers.
 */
export function registerAIHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('arc:ai:chat', handleAIChat)
  ipcMain.handle('arc:ai:stop', handleAIStop)
}

// ============================================================================
// CONFIG HANDLERS
// ============================================================================

/**
 * Generic config get handler.
 * Currently supports provider config via key pattern: "provider:{providerId}"
 */
async function handleConfigGet<T = unknown>(
  _event: IpcMainInvokeEvent,
  key: string
): Promise<T | null> {
  if (key.startsWith('provider:')) {
    const providerId = key.slice('provider:'.length)
    const config = await getProviderConfig(providerId)
    return config as T
  }

  return null
}

/**
 * Generic config set handler.
 * Currently supports provider config via key pattern: "provider:{providerId}"
 */
async function handleConfigSet<T = unknown>(
  _event: IpcMainInvokeEvent,
  key: string,
  value: T
): Promise<void> {
  if (key.startsWith('provider:')) {
    const providerId = key.slice('provider:'.length)
    const config = value as { apiKey?: string; baseUrl?: string }

    const { encryptSecret } = await import('../security')

    await db
      .update(providers)
      .set({
        ...(config.apiKey !== undefined && { apiKey: encryptSecret(config.apiKey) }),
        ...(config.baseUrl !== undefined && { baseUrl: config.baseUrl }),
      })
      .where(eq(providers.id, providerId))
  }
}

/**
 * Registers all arc:config:* handlers.
 */
export function registerConfigHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('arc:config:get', handleConfigGet)
  ipcMain.handle('arc:config:set', handleConfigSet)
}

// ============================================================================
// UI HANDLERS
// ============================================================================

import { showThreadContextMenu } from '../ui/context-menu'
import type { ContextMenuAction } from '../../types/conversations'

/**
 * Show native thread context menu.
 */
async function handleUIShowThreadContextMenu(
  _event: IpcMainInvokeEvent,
  isPinned: boolean
): Promise<ContextMenuAction> {
  return showThreadContextMenu(isPinned)
}

/**
 * Registers all arc:ui:* handlers.
 */
export function registerUIHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('arc:ui:showThreadContextMenu', handleUIShowThreadContextMenu)
}

// ============================================================================
// MAIN REGISTRATION
// ============================================================================

/**
 * Registers all arc:* handlers.
 * Called from main.ts during app initialization.
 */
export function registerArcHandlers(ipcMain: IpcMain): void {
  registerConversationsHandlers(ipcMain)
  registerMessagesHandlers(ipcMain)
  registerModelsHandlers(ipcMain)
  registerAIHandlers(ipcMain)
  registerConfigHandlers(ipcMain)
  registerUIHandlers(ipcMain)
}
