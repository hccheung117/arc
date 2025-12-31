/**
 * AI Library Internal Utilities
 *
 * SSE parsing and normalization helpers. Not exported to consumers.
 */

import type { Usage, FinishReason } from './types'

// ============================================================================
// WIRE FORMAT TYPES (OpenAI SSE response shape)
// ============================================================================

interface ChunkDelta {
  role?: 'assistant'
  content?: string | null
  reasoning_content?: string | null
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

export interface LanguageModelChunk {
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

export function normalizeUsage(wire: ProviderUsage): Usage {
  return {
    inputTokens: wire.prompt_tokens,
    outputTokens: wire.completion_tokens,
    totalTokens: wire.total_tokens,
    reasoningTokens: wire.completion_tokens_details?.reasoning_tokens,
  }
}

export function normalizeFinishReason(reason: string | null | undefined): FinishReason {
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
// SSE PARSING
// ============================================================================

function parseSSELine(line: string): LanguageModelChunk | null {
  const trimmed = line.trim()
  if (!trimmed || !trimmed.startsWith('data:')) return null

  const payload = trimmed.slice(5).trim()
  if (payload === '[DONE]') return null

  try {
    return JSON.parse(payload) as LanguageModelChunk
  } catch {
    return null
  }
}

export async function* parseSSE(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<LanguageModelChunk> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        if (buffer.trim()) {
          const chunk = parseSSELine(buffer)
          if (chunk) yield chunk
        }
        break
      }

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const chunk = parseSSELine(line)
        if (chunk) yield chunk
      }
    }
  } finally {
    reader.releaseLock()
  }
}
