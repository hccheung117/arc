/**
 * Stream transform: Arc/OpenAI SSE chunks → AI SDK LanguageModelV3StreamPart
 * Pure FP approach with generators for testability
 */

import {
  LanguageModelV3FinishReason,
  LanguageModelV3StreamPart,
  LanguageModelV3Usage,
} from '@ai-sdk/provider'
import { ParseResult } from '@ai-sdk/provider-utils'
import { z } from 'zod'
import { convertUsage, mapFinishReason } from './convert'
import { arcChatChunkSchema } from './schemas'

// ============================================================================
// STATE
// ============================================================================

type StreamState = {
  reasoningActive: boolean
  textActive: boolean
  finishReason: LanguageModelV3FinishReason
  usage: LanguageModelV3Usage
}

const initialStreamState: StreamState = {
  reasoningActive: false,
  textActive: false,
  finishReason: { unified: 'other', raw: undefined },
  usage: convertUsage(undefined),
}

// ============================================================================
// PURE GENERATORS
// ============================================================================

type ChunkParseResult = ParseResult<z.infer<typeof arcChatChunkSchema>>

/** Pure generator: chunk → stream parts, returns next state */
function* processChunk(chunk: ChunkParseResult, state: StreamState): Generator<LanguageModelV3StreamPart, StreamState> {
  if (!chunk.success) {
    yield { type: 'error', error: chunk.error }
    return state
  }

  const { value } = chunk
  const choice = value.choices[0]
  const delta = choice?.delta

  let next = { ...state }

  if (choice?.finish_reason) {
    next = { ...next, finishReason: mapFinishReason(choice.finish_reason) }
  }
  if (value.usage) {
    next = { ...next, usage: convertUsage(value.usage) }
  }

  if (!delta) return next

  // Reasoning: try reasoning_content first, fallback to reasoning
  const reasoning = delta.reasoning_content ?? delta.reasoning
  if (reasoning) {
    if (!state.reasoningActive) {
      yield { type: 'reasoning-start', id: 'reasoning-0' }
      next = { ...next, reasoningActive: true }
    }
    yield { type: 'reasoning-delta', id: 'reasoning-0', delta: reasoning }
  }

  // Text content
  if (delta.content) {
    if (!state.textActive) {
      yield { type: 'text-start', id: 'text-0' }
      next = { ...next, textActive: true }
    }
    yield { type: 'text-delta', id: 'text-0', delta: delta.content }
  }

  return next
}

/** Pure generator: emit closing events based on final state */
function* flushStream(state: StreamState): Generator<LanguageModelV3StreamPart> {
  if (state.reasoningActive) {
    yield { type: 'reasoning-end', id: 'reasoning-0' }
  }
  if (state.textActive) {
    yield { type: 'text-end', id: 'text-0' }
  }
  yield { type: 'finish', finishReason: state.finishReason, usage: state.usage }
}

// ============================================================================
// TRANSFORM STREAM
// ============================================================================

/** Factory: creates transformer that pipes chunks through pure functions */
export function createChunkTransformer() {
  let state = initialStreamState

  return new TransformStream<ChunkParseResult, LanguageModelV3StreamPart>({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] })
    },
    transform(chunk, controller) {
      const gen = processChunk(chunk, state)
      let result = gen.next()
      while (!result.done) {
        controller.enqueue(result.value)
        result = gen.next()
      }
      state = result.value
    },
    flush(controller) {
      for (const part of flushStream(state)) {
        controller.enqueue(part)
      }
    },
  })
}
