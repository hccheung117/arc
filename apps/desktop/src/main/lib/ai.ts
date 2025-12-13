import * as fs from 'fs/promises'
import type { Message } from '@arc-types/messages'
import { modelsFile } from '@main/storage'
import { warn, error, logFetch } from './logger'
import { getAttachmentPath, getMessages, insertAssistantMessage } from './messages'
import { getProviderConfig } from './profile'

// ============================================================================
// SSE RESPONSE TYPES
// ============================================================================

/** Delta content in a streaming chunk */
interface StreamDelta {
  role?: 'assistant'
  content?: string | null
  reasoning_content?: string | null
}

/** Choice in a streaming response */
interface StreamChoice {
  index: number
  delta: StreamDelta
  finish_reason?: 'stop' | 'length' | 'content_filter' | null
}

/** Token usage statistics (appears in final chunk) */
interface TokenUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  completion_tokens_details?: {
    reasoning_tokens?: number
  }
}

/** Streaming chunk response */
interface ChatCompletionChunk {
  id: string
  object: 'chat.completion.chunk'
  created: number
  model: string
  choices: StreamChoice[]
  usage?: TokenUsage
}

// ============================================================================
// SSE PARSING
// ============================================================================

/**
 * Parses a single SSE line into a ChatCompletionChunk.
 * Returns null for empty lines, [DONE], or invalid JSON.
 */
function parseSSELine(line: string): ChatCompletionChunk | null {
  const trimmed = line.trim()

  if (!trimmed) return null
  if (!trimmed.startsWith('data:')) return null

  const payload = trimmed.slice(5).trim()
  if (payload === '[DONE]') return null

  try {
    return JSON.parse(payload) as ChatCompletionChunk
  } catch {
    warn('sse', `Failed to parse chunk: ${payload.slice(0, 100)}`)
    return null
  }
}

/**
 * Async generator that yields ChatCompletionChunk from a ReadableStream.
 * Handles UTF-8 decoding and buffering partial lines across chunk boundaries.
 */
async function* parseSSEStream(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<ChatCompletionChunk> {
  const reader = stream.getReader()
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

// ============================================================================
// CHAT COMPLETION REQUEST TYPES
// ============================================================================

/** Text content part for multimodal messages */
interface TextContentPart {
  type: 'text'
  text: string
}

/** Image content part with base64 data URL */
interface ImageContentPart {
  type: 'image_url'
  image_url: {
    url: string // data:image/png;base64,... or https://...
  }
}

/** Union of content part types */
type ContentPart = TextContentPart | ImageContentPart

/** Chat message with role and content (simple or multimodal) */
interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string | ContentPart[]
}

/** Reasoning/thinking configuration */
interface ThinkingConfig {
  reasoning_effort: 'low' | 'medium' | 'high'
}

/** Chat completion request payload */
interface ChatCompletionRequest {
  model: string
  messages: ChatMessage[]
  stream: boolean
  temperature?: number
  thinking?: ThinkingConfig
}

// ============================================================================
// INTERNAL TYPES
// ============================================================================

/** Unified usage format matching storage schema */
export interface NormalizedUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  reasoningTokens?: number
}

/** API error response */
interface APIErrorResponse {
  error: {
    message: string
    type: string
    code: string | null
  }
}

export interface ProviderConfig {
  type: string
  apiKey: string | null
  baseUrl: string | null
}

export interface StreamCallbacks {
  onDelta: (chunk: string) => void
  onReasoning: (chunk: string) => void
  onComplete: (message: Message) => void
  onError: (error: string) => void
}

const activeStreams = new Map<string, AbortController>()

/**
 * Convert database messages to OpenAI Chat API format.
 * Handles multimodal content with base64-encoded images.
 */
export async function toOpenAIMessages(
  messages: Message[],
  conversationId: string,
): Promise<ChatMessage[]> {
  return Promise.all(
    messages.map(async (message): Promise<ChatMessage> => {
      // Only user messages can have multimodal content
      if (message.role === 'user' && message.attachments?.length) {
        const imageParts = await Promise.all(
          message.attachments.map(async (att) => {
            const buffer = await fs.readFile(getAttachmentPath(conversationId, att.path))
            const base64 = buffer.toString('base64')
            return {
              type: 'image_url' as const,
              image_url: {
                url: `data:${att.mimeType};base64,${base64}`,
              },
            }
          }),
        )
        return {
          role: 'user',
          content: [
            ...imageParts,
            { type: 'text' as const, text: message.content },
          ],
        }
      }

      // All other cases: simple text content
      return {
        role: message.role as 'user' | 'assistant' | 'system',
        content: message.content,
      }
    }),
  )
}

/**
 * Get provider ID for a given model.
 */
export async function getModelProvider(modelId: string): Promise<string> {
  const modelsCache = await modelsFile().read()
  const model = modelsCache.models.find((m) => m.id === modelId)

  if (!model) {
    throw new Error(`Model ${modelId} not found`)
  }

  return model.providerId
}

/**
 * Normalize API usage to storage format.
 */
function normalizeUsage(usage: ChatCompletionChunk['usage']): NormalizedUsage {
  if (!usage) {
    return { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
  }
  return {
    inputTokens: usage.prompt_tokens,
    outputTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens,
    reasoningTokens: usage.completion_tokens_details?.reasoning_tokens,
  }
}

/**
 * Stream chat completion via REST API with SSE.
 */
async function streamChatCompletion(
  providerConfig: ProviderConfig,
  modelId: string,
  messages: ChatMessage[],
  callbacks: {
    onDelta: (chunk: string) => void
    onReasoning: (chunk: string) => void
  },
  signal?: AbortSignal,
): Promise<NormalizedUsage> {
  const baseUrl = providerConfig.baseUrl || 'https://api.openai.com/v1'
  const endpoint = `${baseUrl}/chat/completions`

  const requestBody: ChatCompletionRequest = {
    model: modelId,
    messages,
    stream: true,
    temperature: 0,
    thinking: { reasoning_effort: 'high' },
  }

  console.log(`[API] POST ${endpoint} ${modelId} (${messages.length} msgs)`)

  const response = await logFetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(providerConfig.apiKey && { Authorization: `Bearer ${providerConfig.apiKey}` }),
    },
    body: JSON.stringify(requestBody),
    signal,
  })

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`
    try {
      const errorBody = (await response.json()) as APIErrorResponse
      if (errorBody.error?.message) {
        errorMessage = errorBody.error.message
      }
    } catch {
      // Use default error message
    }
    throw new Error(errorMessage)
  }

  if (!response.body) {
    throw new Error('Response body is null')
  }

  let usage: NormalizedUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 }

  for await (const chunk of parseSSEStream(response.body)) {
    const delta = chunk.choices[0]?.delta

    if (delta?.reasoning_content) {
      callbacks.onReasoning(delta.reasoning_content)
    }

    if (delta?.content) {
      callbacks.onDelta(delta.content)
    }

    // Capture usage from final chunk
    if (chunk.usage) {
      usage = normalizeUsage(chunk.usage)
    }
  }

  return usage
}

/**
 * Start AI chat stream with callbacks.
 * This is the high-level streaming function that handles the full flow:
 * fetch messages -> get provider config -> stream -> save result.
 *
 * MEMORY-ONLY STREAMING STRATEGY:
 * ------------------------------
 * Reasoning and content are accumulated in memory during streaming:
 * - UI receives real-time deltas via callbacks (ephemeral)
 * - Storage is NOT touched until streaming completes successfully
 * - On completion, a single atomic write persists the full message
 *
 * Crash behavior:
 * - Crash during streaming -> no storage corruption, user retries cleanly
 * - Crash after completion -> full message is persisted
 *
 * This design treats AI output as "disposable until complete" while
 * treating user input as "precious from the start".
 */
export async function startChatStream(
  streamId: string,
  conversationId: string,
  modelId: string,
  callbacks: StreamCallbacks,
): Promise<void> {
  const abortController = new AbortController()
  activeStreams.set(streamId, abortController)

  try {
    const { messages: conversationMessages } = await getMessages(conversationId)

    const providerId = await getModelProvider(modelId)
    const providerConfig = await getProviderConfig(providerId)

    // Get the parent ID (last message in the conversation)
    const lastMessage = conversationMessages[conversationMessages.length - 1]
    const parentId = lastMessage?.id ?? null

    const openAIMessages = await toOpenAIMessages(conversationMessages, conversationId)

    // MEMORY-ONLY ACCUMULATORS
    // These hold streaming data that will be written atomically on completion.
    // If the stream fails or is cancelled, this data is discarded—by design.
    let fullContent = ''
    let fullReasoning = ''

    const usage = await streamChatCompletion(
      providerConfig,
      modelId,
      openAIMessages,
      {
        onDelta: (chunk) => {
          fullContent += chunk
          callbacks.onDelta(chunk)
        },
        onReasoning: (chunk) => {
          fullReasoning += chunk
          callbacks.onReasoning(chunk)
        },
      },
      abortController.signal,
    )

    const assistantMessage = await insertAssistantMessage(
      conversationId,
      fullContent,
      fullReasoning || undefined,
      parentId,
      modelId,
      providerId,
      usage,
    )
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
export function cancelStream(streamId: string): void {
  const controller = activeStreams.get(streamId)
  if (controller) {
    controller.abort()
    activeStreams.delete(streamId)
  }
}
