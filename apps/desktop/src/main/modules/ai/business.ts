/**
 * AI Business Logic
 *
 * Pure streaming operations — no module dependencies, no persistence.
 * Receives all data as parameters; emits events for results.
 */

import { createId } from '@paralleldrive/cuid2'
import { streamText, type LanguageModelUsage } from 'ai'
import type { ModelMessage } from '@ai-sdk/provider-utils'
import { createArc } from '@main/lib/ai/provider'
import { createClient } from '@main/lib/ai/client'
import type { Logger } from './logger'

// ============================================================================
// TYPES
// ============================================================================

export interface StreamInput {
  provider: { baseURL?: string; apiKey?: string }
  modelId: string
  systemPrompt: string | null
  messages: ModelMessage[]
}

export interface RefineInput {
  provider: { baseURL?: string; apiKey?: string }
  modelId: string
  prompt: string
}

export interface FetchModelsInput {
  baseUrl?: string
  apiKey?: string
}

export interface StreamResult {
  content: string
  reasoning: string
  usage: Usage
}

export interface Usage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  reasoningTokens?: number
}

type Emit = (event: 'delta' | 'reasoning' | 'complete' | 'error', data: unknown) => void

// ============================================================================
// STREAM STATE
// ============================================================================

const activeStreams = new Map<string, AbortController>()

// ============================================================================
// USAGE CONVERSION
// ============================================================================

function convertUsage(usage: LanguageModelUsage): Usage {
  return {
    inputTokens: usage.inputTokens ?? 0,
    outputTokens: usage.outputTokens ?? 0,
    totalTokens: usage.totalTokens ?? 0,
    reasoningTokens: usage.outputTokenDetails?.reasoningTokens,
  }
}

// ============================================================================
// STREAM CONSUMPTION
// ============================================================================

async function consumeStream(
  input: StreamInput,
  abortSignal: AbortSignal,
  onDelta: (chunk: string) => void,
  onReasoning: (chunk: string) => void,
): Promise<StreamResult> {
  const arc = createArc(input.provider)

  const messages: ModelMessage[] = input.systemPrompt
    ? [{ role: 'system', content: input.systemPrompt }, ...input.messages]
    : input.messages

  const result = streamText({
    model: arc(input.modelId),
    messages,
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
// REFINE META PROMPT
// ============================================================================

const REFINE_META_PROMPT = `You are a system prompt refinement assistant. Your task is to improve the user's draft system prompt.

Improve the prompt by:
1. Clarifying vague instructions
2. Adding structure where helpful
3. Removing redundancy
4. Improving tone and professionalism
5. Maintaining the user's original intent

Respond with ONLY the refined system prompt. No explanations, commentary, or meta-text.`

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Start a streaming AI response.
 * Pure — receives all data as params, emits events for results.
 */
export function stream(input: StreamInput, emit: Emit, logger: Logger) {
  const streamId = createId()
  const abortController = new AbortController()
  activeStreams.set(streamId, abortController)

  const execute = async () => {
    try {
      const result = await consumeStream(
        input,
        abortController.signal,
        (chunk) => emit('delta', { streamId, chunk }),
        (chunk) => emit('reasoning', { streamId, chunk }),
      )
      emit('complete', { streamId, ...result })
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error'
        logger.error(`Stream error: ${errorMsg}`, err instanceof Error ? err : undefined)
        emit('error', { streamId, error: errorMsg })
      }
    } finally {
      activeStreams.delete(streamId)
    }
  }

  execute()

  return { streamId }
}

/**
 * Abort an active stream.
 */
export function stop(streamId: string) {
  const controller = activeStreams.get(streamId)
  if (controller) {
    controller.abort()
    activeStreams.delete(streamId)
  }
}

/**
 * Refine a system prompt via streaming.
 * Pure — does not persist results.
 */
export function refine(input: RefineInput, emit: Emit, logger: Logger) {
  const streamId = createId()
  const abortController = new AbortController()
  activeStreams.set(streamId, abortController)

  const execute = async () => {
    try {
      const arc = createArc(input.provider)

      const result = streamText({
        model: arc(input.modelId),
        messages: [
          { role: 'system', content: REFINE_META_PROMPT },
          { role: 'user', content: input.prompt },
        ],
        abortSignal: abortController.signal,
      })

      let content = ''
      for await (const part of result.fullStream) {
        if (part.type === 'text-delta') {
          content += part.text
          emit('delta', { streamId, chunk: part.text })
        }
      }

      const usage = convertUsage(await result.usage)
      emit('complete', { streamId, content, reasoning: '', usage })
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error'
        logger.error(`Refine stream error: ${errorMsg}`, err instanceof Error ? err : undefined)
        emit('error', { streamId, error: errorMsg })
      }
    } finally {
      activeStreams.delete(streamId)
    }
  }

  execute()

  return { streamId }
}

/**
 * Fetch available models from a provider endpoint.
 * Pure HTTP — no caching, no state.
 */
export async function fetchModels(input: FetchModelsInput) {
  const client = createClient(input)
  return client.listModels()
}
