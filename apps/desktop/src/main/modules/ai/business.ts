/**
 * AI Business Logic
 *
 * Pure domain orchestration — no HTTP/protocol knowledge.
 * Receives all data as parameters; emits events for results.
 */

import { createId } from '@paralleldrive/cuid2'
import type httpAdapter from './http'
import type { Logger } from './logger'

// Re-export types for external consumers
export type { Usage, Message } from './http'
import type { Message } from './http'

export interface StreamInput {
  provider: { baseURL?: string; apiKey?: string }
  modelId: string
  systemPrompt: string | null
  messages: Message[]
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

type Emit = (event: 'delta' | 'reasoning' | 'complete' | 'error', data: unknown) => void
type Http = ReturnType<typeof httpAdapter.factory>

// ============================================================================
// STREAM STATE
// ============================================================================

const activeStreams = new Map<string, AbortController>()

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
export function stream(input: StreamInput, emit: Emit, http: Http, logger: Logger) {
  const streamId = createId()
  const controller = new AbortController()
  activeStreams.set(streamId, controller)

  const execute = async () => {
    try {
      const messages: Message[] = input.systemPrompt
        ? [{ role: 'system', content: input.systemPrompt }, ...input.messages]
        : input.messages

      for await (const event of http.streamChat({
        provider: input.provider,
        modelId: input.modelId,
        messages,
        signal: controller.signal,
      })) {
        switch (event.type) {
          case 'delta':
            emit('delta', { streamId, chunk: event.text })
            break
          case 'reasoning':
            emit('reasoning', { streamId, chunk: event.text })
            break
          case 'complete':
            emit('complete', { streamId, ...event })
            break
        }
      }
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
export function refine(input: RefineInput, emit: Emit, http: Http, logger: Logger) {
  const streamId = createId()
  const controller = new AbortController()
  activeStreams.set(streamId, controller)

  const execute = async () => {
    try {
      const messages: Message[] = [
        { role: 'system', content: REFINE_META_PROMPT },
        { role: 'user', content: input.prompt },
      ]

      for await (const event of http.streamChat({
        provider: input.provider,
        modelId: input.modelId,
        messages,
        signal: controller.signal,
      })) {
        switch (event.type) {
          case 'delta':
            emit('delta', { streamId, chunk: event.text })
            break
          case 'complete':
            emit('complete', { streamId, content: event.content, reasoning: '', usage: event.usage })
            break
        }
      }
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
export async function fetchModels(input: FetchModelsInput, http: Http) {
  return http.listModels(input)
}
