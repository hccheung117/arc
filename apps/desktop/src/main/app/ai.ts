/**
 * AI IPC Handlers
 *
 * Orchestration layer for AI streaming operations.
 * Uses AI SDK for streaming with Arc custom provider.
 */

import type { IpcMain } from 'electron'
import { createId } from '@paralleldrive/cuid2'
import { streamText, type LanguageModelUsage } from 'ai'
import type { ModelMessage } from '@ai-sdk/provider-utils'
import { listModels, lookupModelProvider } from '@main/lib/profile/models'
import { resolvePromptSource } from '@main/lib/personas/resolver'
import { createArc } from '@main/lib/ai/provider'
import type { StoredMessageEvent } from '@main/modules/messages/business'
import type { StoredThread } from '@main/modules/threads/json-file'
import { getProviderConfig } from '@main/lib/profile/operations'
import { error } from '@main/foundation/logger'
import { broadcast, registerHandlers } from '@main/kernel/ipc'
import { modelsContract } from '@contracts/models'
import { aiContract } from '@contracts/ai'

// Module APIs injected from kernel
export type AIHandlerDeps = {
  messages: {
    list: (input: { threadId: string }) => Promise<{ messages: StoredMessageEvent[]; branchPoints: unknown[] }>
    create: (input: { threadId: string; input: { role: 'assistant'; content: string; parentId: string | null; modelId: string; providerId: string; reasoning?: string; usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number; reasoningTokens?: number } } }) => Promise<StoredMessageEvent>
    readAttachment: (input: { threadId: string; filename: string }) => Promise<Buffer | null>
  }
  threads: {
    list: () => Promise<StoredThread[]>
  }
}

// ============================================================================
// MESSAGE CONVERSION
// ============================================================================

/**
 * Convert stored messages to AI SDK format.
 * Handles multimodal content by loading attachments via messages module.
 */
async function convertToModelMessages(
  messages: StoredMessageEvent[],
  threadId: string,
  readAttachment: AIHandlerDeps['messages']['readAttachment'],
): Promise<ModelMessage[]> {
  return Promise.all(
    messages.map(async (message): Promise<ModelMessage> => {
      if (message.role === 'user' && message.attachments?.length) {
        const imageResults = await Promise.all(
          message.attachments.map(async (att) => {
            const buffer = await readAttachment({ threadId, filename: att.path })
            if (!buffer) return null
            return {
              type: 'image' as const,
              image: `data:${att.mimeType};base64,${buffer.toString('base64')}`,
              mediaType: att.mimeType,
            }
          }),
        )
        const imageParts = imageResults.filter((p) => p !== null)
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
  | { type: 'complete'; streamId: string; message: StoredMessageEvent | null }
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

async function prepareStreamContext(deps: AIHandlerDeps, threadId: string, modelId: string): Promise<StreamContext> {
  const [{ messages: threadMessages }, threads, providerId] = await Promise.all([
    deps.messages.list({ threadId }),
    deps.threads.list(),
    lookupModelProvider(modelId),
  ])

  const thread = threads.find((t: StoredThread) => t.id === threadId)
  const providerConfig = await getProviderConfig(providerId)
  const parentId = threadMessages.at(-1)?.id ?? null

  // Resolve system prompt from PromptSource
  const resolvedSystemPrompt = thread?.promptSource
    ? await resolvePromptSource(thread.promptSource)
    : null

  const baseMessages = await convertToModelMessages(threadMessages, threadId, deps.messages.readAttachment)
  const messages = resolvedSystemPrompt
    ? [{ role: 'system' as const, content: resolvedSystemPrompt }, ...baseMessages]
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

async function persistStreamResult(deps: AIHandlerDeps, ctx: StreamContext, result: StreamResult) {
  return deps.messages.create({
    threadId: ctx.threadId,
    input: {
      role: 'assistant',
      content: result.content,
      parentId: ctx.parentId,
      modelId: ctx.modelId,
      providerId: ctx.providerId,
      reasoning: result.reasoning || undefined,
      usage: result.usage,
    },
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
  deps: AIHandlerDeps,
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
    const ctx = await prepareStreamContext(deps, threadId, modelId)
    const result = await consumeStream(ctx, abortController.signal, callbacks.onDelta, callbacks.onReasoning)
    const message = await persistStreamResult(deps, ctx, result)
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
// SYSTEM PROMPT REFINEMENT
// ============================================================================

const REFINE_META_PROMPT = `You are a system prompt refinement assistant. Your task is to improve the user's draft system prompt.

Improve the prompt by:
1. Clarifying vague instructions
2. Adding structure where helpful
3. Removing redundancy
4. Improving tone and professionalism
5. Maintaining the user's original intent

Respond with ONLY the refined system prompt. No explanations, commentary, or meta-text.`

/**
 * Orchestrates system prompt refinement streaming.
 * Unlike chat streaming, this does not persist results.
 */
async function executeRefineStream(
  streamId: string,
  prompt: string,
  modelId: string,
  callbacks: {
    onDelta: (chunk: string) => void
    onComplete: () => void
    onError: (error: string) => void
  },
): Promise<void> {
  const abortController = new AbortController()
  activeStreams.set(streamId, abortController)

  try {
    const providerId = await lookupModelProvider(modelId)
    const providerConfig = await getProviderConfig(providerId)
    const arc = createArc({
      baseURL: providerConfig.baseUrl ?? undefined,
      apiKey: providerConfig.apiKey ?? undefined,
    })

    const result = streamText({
      model: arc(modelId),
      messages: [
        { role: 'system', content: REFINE_META_PROMPT },
        { role: 'user', content: prompt },
      ],
      abortSignal: abortController.signal,
    })

    for await (const part of result.fullStream) {
      if (part.type === 'text-delta') {
        callbacks.onDelta(part.text)
      }
    }

    callbacks.onComplete()
  } catch (err) {
    if ((err as Error).name !== 'AbortError') {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      error('refine', `Refine stream error: ${errorMsg}`)
      callbacks.onError(errorMsg)
    }
  } finally {
    activeStreams.delete(streamId)
  }
}

// ============================================================================
// REGISTRATION
// ============================================================================

export function registerAIHandlers(ipcMain: IpcMain, deps: AIHandlerDeps): void {
  // Models
  registerHandlers(ipcMain, modelsContract, {
    list: async () => listModels(),
  })

  // AI Streaming
  registerHandlers(ipcMain, aiContract, {
    chat: async ({ threadId, model }) => {
      const streamId = createId()

      executeStream(deps, streamId, threadId, model, {
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

    refine: async ({ prompt, model }) => {
      const streamId = createId()

      executeRefineStream(streamId, prompt, model, {
        onDelta: (chunk) => emitAIStreamEvent({ type: 'delta', streamId, chunk }),
        onComplete: () => emitAIStreamEvent({ type: 'complete', streamId, message: null }),
        onError: (err) => emitAIStreamEvent({ type: 'error', streamId, error: err }),
      }).catch((err) => {
        const errorMsg = err instanceof Error ? err.message : 'Unknown refine error'
        error('refine', errorMsg, err as Error)
        emitAIStreamEvent({ type: 'error', streamId, error: errorMsg })
      })

      return { streamId }
    },
  })
}
