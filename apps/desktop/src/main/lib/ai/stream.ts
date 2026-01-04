/**
 * AI Streaming
 *
 * Stream processing for OpenAI-compatible chat completions.
 * Returns an async iterable and an abort function.
 */

import type { ChatMessage, Usage } from './types'
import { parseSSE } from './utils'
import { createClient } from './http'

// ============================================================================
// WIRE FORMAT TYPES (OpenAI SSE response shape)
// ============================================================================

interface ChunkDelta {
  role?: 'assistant'
  content?: string | null
  reasoning_content?: string | null
  reasoning?: string | null
}

interface ChunkChoice {
  index: number
  delta: ChunkDelta
  finish_reason?: 'stop' | 'length' | 'content_filter' | null
}

interface ProviderUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  completion_tokens_details?: {
    reasoning_tokens?: number
  }
}

interface LanguageModelChunk {
  id: string
  object: 'chat.completion.chunk'
  created: number
  model: string
  choices: ChunkChoice[]
  usage?: ProviderUsage
}

// ============================================================================
// NORMALIZATION
// ============================================================================

function normalizeUsage(wire: ProviderUsage | undefined): Usage | undefined {
  if (!wire) return undefined
  return {
    inputTokens: wire.prompt_tokens,
    outputTokens: wire.completion_tokens,
    totalTokens: wire.total_tokens,
    reasoningTokens: wire.completion_tokens_details?.reasoning_tokens,
  }
}

type FinishReason = 'stop' | 'length' | 'content-filter' | 'error' | 'unknown'

function normalizeFinishReason(reason: string | null | undefined): FinishReason {
  switch (reason) {
    case 'stop':
      return 'stop'
    case 'length':
      return 'length'
    case 'content_filter':
      return 'content-filter'
    default:
      return 'unknown'
  }
}

// ============================================================================
// STREAM EVENTS
// ============================================================================

type StreamEvent =
  | { type: 'content'; delta: string }
  | { type: 'reasoning'; delta: string }
  | { type: 'usage'; usage: Usage }
  | { type: 'done'; finishReason: FinishReason }

type StreamOptions = {
  modelId: string
  baseUrl?: string | null
  apiKey?: string | null
  messages: ChatMessage[]
  temperature?: number
  reasoningEffort?: 'low' | 'medium' | 'high'
}

// --- Pure functions ---

type ChunkResult = {
  events: StreamEvent[]
  usage?: Usage
  finishReason?: FinishReason
}

function processChunk(chunk: LanguageModelChunk): ChunkResult {
  const events: StreamEvent[] = []
  const delta = chunk.choices[0]?.delta

  const reasoning = delta?.reasoning_content ?? delta?.reasoning
  if (reasoning) {
    events.push({ type: 'reasoning', delta: reasoning })
  }

  if (delta?.content) {
    events.push({ type: 'content', delta: delta.content })
  }

  return {
    events,
    usage: normalizeUsage(chunk.usage),
    finishReason: normalizeFinishReason(chunk.choices[0]?.finish_reason),
  }
}

// --- Effectful functions ---

async function* generate(
  options: StreamOptions,
  signal: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const client = createClient({
    baseUrl: options.baseUrl,
    apiKey: options.apiKey,
  })
  const stream = await client.streamChatCompletions(
    {
      model: options.modelId,
      messages: options.messages,
      ...(options.temperature !== undefined && { temperature: options.temperature }),
      ...(options.reasoningEffort && { thinking: { reasoning_effort: options.reasoningEffort } }),
    },
    signal,
  )

  let usage: Usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
  let finishReason: FinishReason = 'unknown'

  for await (const chunk of parseSSE<LanguageModelChunk>(stream)) {
    const result = processChunk(chunk)

    yield* result.events
    if (result.usage) usage = result.usage
    if (result.finishReason) finishReason = result.finishReason
  }

  yield { type: 'usage', usage }
  yield { type: 'done', finishReason }
}

// --- Public API ---

export function streamText(options: StreamOptions) {
  const abortController = new AbortController()

  return {
    textStream: generate(options, abortController.signal),
    abort: () => abortController.abort(),
  }
}
