/**
 * AI IPC Handlers
 *
 * Orchestration layer for AI streaming operations.
 * Composes building blocks from lib/ modules.
 */

import * as fs from 'fs/promises'
import type { IpcMain } from 'electron'
import { createId } from '@paralleldrive/cuid2'
import { z } from 'zod'
import type { Model } from '@arc-types/models'
import { listModels, lookupModelProvider } from '@main/app/models'
import { streamText } from '@main/lib/ai/stream'
import type { Message, Usage } from '@main/lib/ai/types'
import type { StoredMessageEvent } from '@main/lib/messages/schemas'
import { readMessages, appendMessage } from '@main/lib/messages/operations'
import { getProviderConfig } from '@main/lib/profile/operations'
import { getThreadAttachmentPath } from '@main/lib/arcfs/paths'
import { error } from '@main/foundation/logger'
import { validated, broadcast } from '@main/foundation/ipc'

// ============================================================================
// MESSAGE CONVERSION
// ============================================================================

/**
 * Convert stored messages to AI library format.
 * Handles multimodal content by loading attachments from disk.
 */
async function convertToModelMessages(messages: StoredMessageEvent[], threadId: string): Promise<Message[]> {
  return Promise.all(
    messages.map(async (message): Promise<Message> => {
      if (message.role === 'user' && message.attachments?.length) {
        const imageParts = await Promise.all(
          message.attachments.map(async (att) => {
            const buffer = await fs.readFile(getThreadAttachmentPath(threadId, att.path))
            const base64 = buffer.toString('base64')
            return {
              type: 'image_url' as const,
              image_url: { url: `data:${att.mimeType};base64,${base64}` },
            }
          }),
        )
        return {
          role: 'user',
          content: [...imageParts, { type: 'text' as const, text: message.content! }],
        }
      }

      return {
        role: message.role as 'user' | 'assistant' | 'system',
        content: message.content!,
      }
    }),
  )
}

// ============================================================================
// STREAM STATE
// ============================================================================

const activeStreams = new Map<string, AbortController>()

// ============================================================================
// AI STREAM EVENTS
// ============================================================================

type AIStreamEvent =
  | { type: 'delta'; streamId: string; chunk: string }
  | { type: 'reasoning'; streamId: string; chunk: string }
  | { type: 'complete'; streamId: string; message: StoredMessageEvent }
  | { type: 'error'; streamId: string; error: string }

function emitAIStreamEvent(event: AIStreamEvent): void {
  broadcast('arc:ai:event', event)
}

// ============================================================================
// STREAMING ORCHESTRATION
// ============================================================================

interface StreamCallbacks {
  onDelta: (chunk: string) => void
  onReasoning: (chunk: string) => void
  onComplete: (message: StoredMessageEvent) => void
  onError: (error: string) => void
}

/**
 * Orchestrates AI chat streaming.
 * Composes: messages → profile → ai → messages
 *
 * MEMORY-ONLY STREAMING STRATEGY:
 * Content accumulates via the result object pattern.
 * Storage is NOT touched until streaming completes successfully.
 * On completion, a single atomic write persists the full message.
 */
async function executeStream(
  streamId: string,
  threadId: string,
  modelId: string,
  callbacks: StreamCallbacks,
): Promise<void> {
  const abortController = new AbortController()
  activeStreams.set(streamId, abortController)

  try {
    const { messages: threadMessages } = await readMessages(threadId)

    const providerId = await lookupModelProvider(modelId)
    const providerConfig = await getProviderConfig(providerId)

    // Get the parent ID (last message in the thread)
    const lastMessage = threadMessages[threadMessages.length - 1]
    const parentId = lastMessage?.id ?? null

    const modelMessages = await convertToModelMessages(threadMessages, threadId)

    const stream = streamText({
      baseUrl: providerConfig.baseUrl ?? undefined,
      apiKey: providerConfig.apiKey ?? undefined,
      model: modelId,
      messages: modelMessages,
      signal: abortController.signal,
    })

    let fullContent = ''
    let fullReasoning = ''
    let usage: Usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 }

    for await (const event of stream) {
      switch (event.type) {
        case 'content':
          fullContent += event.delta
          callbacks.onDelta(event.delta)
          break
        case 'reasoning':
          fullReasoning += event.delta
          callbacks.onReasoning(event.delta)
          break
        case 'usage':
          usage = event.usage
          break
      }
    }

    const { message: assistantMessage } = await appendMessage({
      type: 'new',
      threadId,
      role: 'assistant',
      content: fullContent,
      parentId,
      modelId,
      providerId,
      reasoning: fullReasoning || undefined,
      usage,
    })
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
  return listModels()
}

function registerModelsHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('arc:models:list', handleModelsList)
}

// ============================================================================
// AI STREAMING HANDLERS
// ============================================================================

const ChatOptionsSchema = z.object({
  model: z.string(),
})

const handleAIChat = validated(
  [z.string(), ChatOptionsSchema],
  async (threadId, options): Promise<{ streamId: string }> => {
    const streamId = createId()

    executeStream(streamId, threadId, options.model, {
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
