/**
 * AI IPC Handlers
 *
 * Orchestration layer for AI streaming operations.
 * Uses AI SDK for streaming with Arc custom provider.
 */

import * as fs from 'fs/promises'
import type { IpcMain } from 'electron'
import { createId } from '@paralleldrive/cuid2'
import { streamText, type LanguageModelUsage } from 'ai'
import type { ModelMessage } from '@ai-sdk/provider-utils'
import { listModels, lookupModelProvider } from '@main/lib/profile/models'
import { createArc } from '@main/lib/ai/provider'
import type { StoredMessageEvent } from '@boundary/messages'
import { threadStorage } from '@boundary/messages'
import { readMessages, appendMessage } from '@main/lib/messages/operations'
import { findById } from '@main/lib/messages/tree'
import { getProviderConfig } from '@main/lib/profile/operations'
import { getThreadAttachmentPath } from '@main/foundation/paths'
import { error } from '@main/foundation/logger'
import { broadcast } from '@main/foundation/ipc'
import { registerHandlers } from '@main/foundation/contract'
import { modelsContract } from '@contracts/models'
import { aiContract } from '@contracts/ai'

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
// STREAM CONTEXT
// ============================================================================

interface StreamContext {
  messages: ModelMessage[]
  parentId: string | null
  provider: { baseURL?: string; apiKey?: string }
  providerId: string
  modelId: string
  threadId: string
}

async function prepareStreamContext(threadId: string, modelId: string): Promise<StreamContext> {
  const [{ messages: threadMessages }, threadIndex, providerId] = await Promise.all([
    readMessages(threadId),
    threadStorage.read(),
    lookupModelProvider(modelId),
  ])

  const thread = findById(threadIndex.threads, threadId)
  const providerConfig = await getProviderConfig(providerId)
  const parentId = threadMessages.at(-1)?.id ?? null

  const baseMessages = await convertToModelMessages(threadMessages, threadId)
  const messages = thread?.systemPrompt
    ? [{ role: 'system' as const, content: thread.systemPrompt }, ...baseMessages]
    : baseMessages

  return {
    messages,
    parentId,
    provider: { baseURL: providerConfig.baseUrl ?? undefined, apiKey: providerConfig.apiKey ?? undefined },
    providerId,
    modelId,
    threadId,
  }
}

// ============================================================================
// STREAM CONSUMPTION
// ============================================================================

interface StreamResult {
  content: string
  reasoning: string
  usage: ReturnType<typeof convertUsage>
}

async function consumeStream(
  ctx: StreamContext,
  abortSignal: AbortSignal,
  onDelta: (chunk: string) => void,
  onReasoning: (chunk: string) => void,
): Promise<StreamResult> {
  const arc = createArc(ctx.provider)

  const result = streamText({
    model: arc(ctx.modelId),
    messages: ctx.messages,
    providerOptions: { arc: { reasoningEffort: 'high' } },
    abortSignal,
  })

  let content = ''
  let reasoning = ''

  for await (const part of result.fullStream) {
    if (part.type === 'text-delta') {
      content += part.text
      onDelta(part.text)
    } else if (part.type === 'reasoning-delta') {
      reasoning += part.text
      onReasoning(part.text)
    }
  }

  return { content, reasoning, usage: convertUsage(await result.usage) }
}

// ============================================================================
// STREAM PERSISTENCE
// ============================================================================

async function persistStreamResult(ctx: StreamContext, result: StreamResult) {
  return appendMessage({
    type: 'new',
    threadId: ctx.threadId,
    role: 'assistant',
    content: result.content,
    parentId: ctx.parentId,
    modelId: ctx.modelId,
    providerId: ctx.providerId,
    reasoning: result.reasoning || undefined,
    usage: result.usage,
  })
}

// ============================================================================
// STREAMING ORCHESTRATION
// ============================================================================

/**
 * Orchestrates AI chat streaming.
 *
 * Flow: prepare context → consume stream → persist result
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
  activeStreams.set(streamId, abortController)

  try {
    const ctx = await prepareStreamContext(threadId, modelId)
    const result = await consumeStream(ctx, abortController.signal, callbacks.onDelta, callbacks.onReasoning)
    const { message } = await persistStreamResult(ctx, result)
    callbacks.onComplete(message)
  } catch (err) {
    if ((err as Error).name !== 'AbortError') {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      error('chat', `Stream error: ${errorMsg}`)
      callbacks.onError(errorMsg)
    }
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
// REGISTRATION
// ============================================================================

export function registerAIHandlers(ipcMain: IpcMain): void {
  // Models
  registerHandlers(ipcMain, modelsContract, {
    list: async () => listModels(),
  })

  // AI Streaming
  registerHandlers(ipcMain, aiContract, {
    chat: async ({ threadId, model }) => {
      const streamId = createId()

      executeStream(streamId, threadId, model, {
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

    stop: async ({ streamId }) => {
      cancelStream(streamId)
    },
  })
}
