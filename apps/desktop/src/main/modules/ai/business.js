/**
 * AI Business Logic
 *
 * Pure domain orchestration — no HTTP/protocol knowledge.
 * Receives all data as parameters; emits events for results.
 */

import { createId } from '@paralleldrive/cuid2'

const extractErrorMessage = (err) => {
  if (!(err instanceof Error)) return 'Unknown error'

  const httpErr = err
  if (httpErr.body) {
    try {
      const parsed = JSON.parse(httpErr.body)
      if (parsed.error?.message) return parsed.error.message
      if (parsed.message) return parsed.message
    } catch {
      return httpErr.body
    }
  }

  return err.message
}

// ============================================================================
// STREAM STATE
// ============================================================================

const activeStreams = new Map()

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
export function stream(input, emit, http, logger) {
  const streamId = createId()
  const controller = new AbortController()
  activeStreams.set(streamId, controller)

  const execute = async () => {
    try {
      const messages = input.systemPrompt
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
      if (err.name !== 'AbortError') {
        const errorMsg = extractErrorMessage(err)
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
export function stop(streamId) {
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
export function refine(input, emit, http, logger) {
  const streamId = createId()
  const controller = new AbortController()
  activeStreams.set(streamId, controller)

  const execute = async () => {
    try {
      const messages = [
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
      if (err.name !== 'AbortError') {
        const errorMsg = extractErrorMessage(err)
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
export async function fetchModels(input, http) {
  return http.listModels(input)
}
