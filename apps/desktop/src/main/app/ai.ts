/**
 * AI IPC Handlers
 *
 * Orchestration layer for AI streaming operations.
 * Composes building blocks from lib/ modules.
 */

import type { IpcMain } from 'electron'
import { createId } from '@paralleldrive/cuid2'
import { z } from 'zod'
import type { ChatResponse, AIStreamEvent } from '@arc-types/arc-api'
import { ChatOptionsSchema } from '@arc-types/arc-api'
import type { Model } from '@arc-types/models'
import type { Message } from '@arc-types/messages'
import { getModels } from '@main/lib/models/operations'
import { streamChatCompletion, toOpenAIMessages, getModelProvider, type NormalizedUsage } from '@main/lib/ai'
import { getMessages, insertAssistantMessage } from '@main/lib/messages/operations'
import { getProviderConfig } from '@main/lib/profile/operations'
import { error } from '@main/foundation/logger'
import { validated, broadcast } from '@main/foundation/ipc'

// ============================================================================
// STREAM STATE
// ============================================================================

const activeStreams = new Map<string, AbortController>()

// ============================================================================
// AI STREAM EVENTS
// ============================================================================

function emitAIStreamEvent(event: AIStreamEvent): void {
  broadcast('arc:ai:event', event)
}

// ============================================================================
// STREAMING ORCHESTRATION
// ============================================================================

interface StreamCallbacks {
  onDelta: (chunk: string) => void
  onReasoning: (chunk: string) => void
  onComplete: (message: Message) => void
  onError: (error: string) => void
}

/**
 * Orchestrates AI chat streaming.
 * Composes: messages → profile → ai → messages
 *
 * MEMORY-ONLY STREAMING STRATEGY:
 * Reasoning and content are accumulated in memory during streaming.
 * Storage is NOT touched until streaming completes successfully.
 * On completion, a single atomic write persists the full message.
 */
async function executeStream(
  streamId: string,
  conversationId: string,
  modelId: string,
  callbacks: StreamCallbacks,
): Promise<void> {
  const abortController = new AbortController()
  activeStreams.set(streamId, abortController)

  try {
    const { messages: conversationMessages } = await getMessages(conversationId)

    const providerId = await getModelProvider(modelId)
    const providerConfig = await getProviderConfig(providerId)

    // Get the parent ID (last message in the conversation)
    const lastMessage = conversationMessages[conversationMessages.length - 1]
    const parentId = lastMessage?.id ?? null

    const openAIMessages = await toOpenAIMessages(conversationMessages, conversationId)

    // Memory-only accumulators - written atomically on completion
    let fullContent = ''
    let fullReasoning = ''

    const usage = await streamChatCompletion(
      providerConfig,
      modelId,
      openAIMessages,
      {
        onDelta: (chunk) => {
          fullContent += chunk
          callbacks.onDelta(chunk)
        },
        onReasoning: (chunk) => {
          fullReasoning += chunk
          callbacks.onReasoning(chunk)
        },
      },
      abortController.signal,
    )

    const assistantMessage = await insertAssistantMessage(
      conversationId,
      fullContent,
      fullReasoning || undefined,
      parentId,
      modelId,
      providerId,
      usage as NormalizedUsage,
    )
    callbacks.onComplete(assistantMessage)
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      return
    }

    const errorMsg = err instanceof Error ? err.message : 'Unknown error'
    error('chat', `Stream error: ${errorMsg}`)
    callbacks.onError(errorMsg)
  } finally {
    activeStreams.delete(streamId)
  }
}

/**
 * Cancel an active AI stream.
 */
function cancelStream(streamId: string): void {
  const controller = activeStreams.get(streamId)
  if (controller) {
    controller.abort()
    activeStreams.delete(streamId)
  }
}

// ============================================================================
// MODELS HANDLERS
// ============================================================================

async function handleModelsList(): Promise<Model[]> {
  return getModels()
}

function registerModelsHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('arc:models:list', handleModelsList)
}

// ============================================================================
// AI STREAMING HANDLERS
// ============================================================================

const handleAIChat = validated(
  [z.string(), ChatOptionsSchema],
  async (conversationId, options): Promise<ChatResponse> => {
    const streamId = createId()

    executeStream(streamId, conversationId, options.model, {
      onDelta: (chunk) => emitAIStreamEvent({ type: 'delta', streamId, chunk }),
      onReasoning: (chunk) => emitAIStreamEvent({ type: 'reasoning', streamId, chunk }),
      onComplete: (message) => emitAIStreamEvent({ type: 'complete', streamId, message }),
      onError: (err) => emitAIStreamEvent({ type: 'error', streamId, error: err }),
    }).catch((err) => {
      const errorMsg = err instanceof Error ? err.message : 'Unknown streaming error'
      error('chat', errorMsg, err as Error)
      emitAIStreamEvent({ type: 'error', streamId, error: errorMsg })
    })

    return { streamId }
  }
)

const handleAIStop = validated([z.string()], async (streamId) => {
  cancelStream(streamId)
})

function registerAIStreamHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('arc:ai:chat', handleAIChat)
  ipcMain.handle('arc:ai:stop', handleAIStop)
}

// ============================================================================
// MAIN REGISTRATION
// ============================================================================

export function registerAIHandlers(ipcMain: IpcMain): void {
  registerModelsHandlers(ipcMain)
  registerAIStreamHandlers(ipcMain)
}
