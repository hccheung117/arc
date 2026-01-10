/**
 * AI IPC Handlers
 *
 * Orchestration layer for AI streaming operations.
 * Uses AI SDK for streaming with Arc custom provider.
 */

import * as fs from 'fs/promises'
import type { IpcMain } from 'electron'
import { createId } from '@paralleldrive/cuid2'
import { z } from 'zod'
import { streamText, type LanguageModelUsage } from 'ai'
import type { ModelMessage } from '@ai-sdk/provider-utils'
import { listModels, lookupModelProvider } from '@main/lib/profile/models'
import { createArc } from '@main/lib/ai/provider'
import type { StoredMessageEvent } from '@main/lib/messages/schemas'
import { readMessages, appendMessage } from '@main/lib/messages/operations'
import { getProviderConfig } from '@main/lib/profile/operations'
import { getThreadAttachmentPath } from '@main/foundation/paths'
import { error } from '@main/foundation/logger'
import { validated, broadcast, register } from '@main/foundation/ipc'

// ============================================================================
// MESSAGE CONVERSION
// ============================================================================

/**
 * Convert stored messages to AI SDK format.
 * Handles multimodal content by loading attachments from disk.
 */
async function convertToModelMessages(messages: StoredMessageEvent[], threadId: string): Promise<ModelMessage[]> {
  return Promise.all(
    messages.map(async (message): Promise<ModelMessage> => {
      if (message.role === 'user' && message.attachments?.length) {
        const imageParts = await Promise.all(
          message.attachments.map(async (att) => {
            const buffer = await fs.readFile(getThreadAttachmentPath(threadId, att.path))
            const base64 = buffer.toString('base64')
            return {
              type: 'image' as const,
              image: `data:${att.mimeType};base64,${base64}`,
              mediaType: att.mimeType,
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
// USAGE CONVERSION
// ============================================================================

function convertUsage(usage: LanguageModelUsage) {
  return {
    inputTokens: usage.inputTokens ?? 0,
    outputTokens: usage.outputTokens ?? 0,
    totalTokens: usage.totalTokens ?? 0,
    reasoningTokens: usage.outputTokenDetails?.reasoningTokens,
  }
}

// ============================================================================
// STREAMING ORCHESTRATION
// ============================================================================

/**
 * Orchestrates AI chat streaming.
 * Uses AI SDK streamText with Arc custom provider.
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
  callbacks: {
    onDelta: (chunk: string) => void
    onReasoning: (chunk: string) => void
    onComplete: (message: StoredMessageEvent) => void
    onError: (error: string) => void
  },
): Promise<void> {
  const abortController = new AbortController()

  try {
    const { messages: threadMessages } = await readMessages(threadId)

    const providerId = await lookupModelProvider(modelId)
    const providerConfig = await getProviderConfig(providerId)

    // Get the parent ID (last message in the thread)
    const lastMessage = threadMessages[threadMessages.length - 1]
    const parentId = lastMessage?.id ?? null

    const modelMessages = await convertToModelMessages(threadMessages, threadId)

    // Create Arc provider with config
    const arc = createArc({
      baseURL: providerConfig.baseUrl ?? undefined,
      apiKey: providerConfig.apiKey ?? undefined,
    })

    activeStreams.set(streamId, abortController)

    const result = streamText({
      model: arc(modelId),
      messages: modelMessages,
      providerOptions: {
        arc: { reasoningEffort: 'high' },
      },
      abortSignal: abortController.signal,
    })

    let fullContent = ''
    let fullReasoning = ''

    // Consume the full stream for all event types
    for await (const part of result.fullStream) {
      switch (part.type) {
        case 'text-delta':
          fullContent += part.text
          callbacks.onDelta(part.text)
          break
        case 'reasoning-delta':
          fullReasoning += part.text
          callbacks.onReasoning(part.text)
          break
      }
    }

    // Get final usage
    const usage = convertUsage(await result.usage)

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
// SCHEMAS
// ============================================================================

const ChatOptionsSchema = z.object({
  model: z.string(),
})

// ============================================================================
// MODELS
// ============================================================================

const modelHandlers = {
  'arc:models:list': listModels,
}

// ============================================================================
// AI STREAMING
// ============================================================================

const aiStreamHandlers = {
  'arc:ai:chat': validated(
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
    },
  ),

  'arc:ai:stop': validated([z.string()], async (streamId) => {
    cancelStream(streamId)
  }),
}

// ============================================================================
// REGISTRATION
// ============================================================================

export function registerAIHandlers(ipcMain: IpcMain): void {
  register(ipcMain, modelHandlers)
  register(ipcMain, aiStreamHandlers)
}
