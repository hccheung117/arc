/**
 * AI HTTP Capability Adapter
 *
 * Library for business — absorbs all AI-specific HTTP complexity:
 * - OpenAI-compatible API protocol
 * - SSE chunk parsing and stream state management
 * - Usage conversion to domain types
 */

import { z } from 'zod'
import { defineCapability, type FoundationCapabilities } from '@main/kernel/module'

// ============================================================================
// PROTOCOL SCHEMAS
// ============================================================================

const ChatChunkSchema = z.object({
  id: z.string().nullish(),
  created: z.number().nullish(),
  model: z.string().nullish(),
  choices: z.array(
    z.object({
      delta: z
        .object({
          role: z.enum(['assistant']).nullish(),
          content: z.string().nullish(),
          reasoning_content: z.string().nullish(),
          reasoning: z.string().nullish(),
        })
        .nullish(),
      finish_reason: z.string().nullish(),
      index: z.number(),
    })
  ),
  usage: z
    .object({
      prompt_tokens: z.number().nullish(),
      completion_tokens: z.number().nullish(),
      total_tokens: z.number().nullish(),
      completion_tokens_details: z
        .object({
          reasoning_tokens: z.number().nullish(),
        })
        .nullish(),
    })
    .nullish(),
})

type ChatChunk = z.infer<typeof ChatChunkSchema>

// ============================================================================
// DOMAIN TYPES
// ============================================================================

export interface Usage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  reasoningTokens?: number
}

export type StreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'reasoning'; text: string }
  | { type: 'complete'; content: string; reasoning: string; usage: Usage }

// Message content can be string or array of parts (for multimodal)
type TextPart = { type: 'text'; text: string }
type ImagePart = { type: 'image'; image: string; mediaType?: string }
type ContentPart = TextPart | ImagePart

export interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string | ContentPart[]
}

// ============================================================================
// USAGE CONVERSION
// ============================================================================

function convertUsage(chunk: ChatChunk): Usage {
  return {
    inputTokens: chunk.usage?.prompt_tokens ?? 0,
    outputTokens: chunk.usage?.completion_tokens ?? 0,
    totalTokens: (chunk.usage?.prompt_tokens ?? 0) + (chunk.usage?.completion_tokens ?? 0),
    reasoningTokens: chunk.usage?.completion_tokens_details?.reasoning_tokens ?? undefined,
  }
}

// ============================================================================
// STREAM STATE
// ============================================================================

interface StreamState {
  content: string
  reasoning: string
  usage: Usage
}

const initialState: StreamState = {
  content: '',
  reasoning: '',
  usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
}

// ============================================================================
// CAPABILITY DEFINITION
// ============================================================================

type Http = FoundationCapabilities['http']

// Convert our Message format to OpenAI API format
function convertMessageToApi(message: Message): unknown {
  // String content passes through directly
  if (typeof message.content === 'string') {
    return { role: message.role, content: message.content }
  }

  // Array content needs conversion to OpenAI format
  const content = message.content.map((part) => {
    if (part.type === 'text') {
      return { type: 'text', text: part.text }
    }
    // Image part: convert to OpenAI image_url format
    return { type: 'image_url', image_url: { url: part.image } }
  })

  return { role: message.role, content }
}

export default defineCapability((http: Http) => ({
  /**
   * Stream chat completion from provider.
   * Yields domain-level events, not protocol chunks.
   */
  async *streamChat(params: {
    provider: { baseURL?: string; apiKey?: string }
    modelId: string
    messages: Message[]
    signal: AbortSignal
  }): AsyncGenerator<StreamEvent> {
    const baseURL = params.provider.baseURL ?? 'https://api.openai.com/v1'
    const url = `${baseURL}/chat/completions`

    const body = {
      model: params.modelId,
      messages: params.messages.map(convertMessageToApi),
      stream: true,
      reasoning_effort: 'high',
      thinking: { reasoning_effort: 'high' },
    }

    const headers: Record<string, string> = {
      ...(params.provider.apiKey && { Authorization: `Bearer ${params.provider.apiKey}` }),
    }

    let state = { ...initialState }

    for await (const raw of http.postJsonStream<unknown>(url, body, { headers, signal: params.signal })) {
      const parsed = ChatChunkSchema.safeParse(raw)
      if (!parsed.success) continue

      const chunk = parsed.data
      const delta = chunk.choices[0]?.delta

      if (chunk.usage) {
        state = { ...state, usage: convertUsage(chunk) }
      }

      if (!delta) continue

      const reasoning = delta.reasoning_content ?? delta.reasoning
      if (reasoning) {
        state = { ...state, reasoning: state.reasoning + reasoning }
        yield { type: 'reasoning', text: reasoning }
      }

      if (delta.content) {
        state = { ...state, content: state.content + delta.content }
        yield { type: 'delta', text: delta.content }
      }
    }

    yield { type: 'complete', content: state.content, reasoning: state.reasoning, usage: state.usage }
  },

  /**
   * Fetch available models from provider.
   */
  async listModels(params: { baseUrl?: string; apiKey?: string }): Promise<Array<{ id: string }>> {
    const baseURL = params.baseUrl ?? 'https://api.openai.com/v1'
    const url = `${baseURL}/models`

    const headers: Record<string, string> = {
      ...(params.apiKey && { Authorization: `Bearer ${params.apiKey}` }),
    }

    const response = await http.getJson<{ data: Array<{ id: string }> }>(url, { headers })
    return response.data.data
  },
}))
