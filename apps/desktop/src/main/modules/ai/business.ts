/**
 * AI Business Logic
 *
 * Consolidated AI module: protocol schemas, format conversion, stream transformation,
 * provider implementation, and domain operations.
 *
 * Pure streaming operations — no module dependencies, no persistence.
 * Receives all data as parameters; emits events for results.
 */

import { z } from 'zod'
import { createId } from '@paralleldrive/cuid2'
import { streamText, type LanguageModelUsage } from 'ai'
import type { ModelMessage, ParseResult } from '@ai-sdk/provider-utils'
import {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3FinishReason,
  LanguageModelV3Prompt,
  LanguageModelV3StreamPart,
  LanguageModelV3StreamResult,
  LanguageModelV3Usage,
  UnsupportedFunctionalityError,
} from '@ai-sdk/provider'
import {
  combineHeaders,
  createEventSourceResponseHandler,
  createJsonErrorResponseHandler,
  FetchFunction,
  parseProviderOptions,
  postJsonToApi,
} from '@ai-sdk/provider-utils'
import type { Logger } from './logger'

// ============================================================================
// SECTION 1: PROTOCOL SCHEMAS (from boundary/ai.ts)
// ============================================================================

const ArcProviderOptionsSchema = z.object({
  reasoningEffort: z.enum(['low', 'medium', 'high']).optional(),
})

const ArcErrorSchema = z.object({
  error: z.object({
    message: z.string(),
    type: z.string().optional(),
  }),
})

const ArcChatChunkSchema = z.object({
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

type ArcChatChunk = z.infer<typeof ArcChatChunkSchema>

const arcStreamHandler = createEventSourceResponseHandler(ArcChatChunkSchema)

const arcErrorHandler = createJsonErrorResponseHandler({
  errorSchema: ArcErrorSchema,
  errorToMessage: (data) => data.error.message,
})

// ============================================================================
// SECTION 2: FORMAT CONVERSION (from lib/ai/convert.ts)
// ============================================================================

type UserPart = Extract<LanguageModelV3Prompt[number], { role: 'user' }>
type FilePart = Extract<UserPart['content'][number], { type: 'file' }>

const toDataUrl = (part: FilePart) => {
  const { data, mediaType } = part
  if (typeof data === 'string') return data.startsWith('data:') ? data : `data:${mediaType};base64,${data}`
  if (data instanceof URL) return data.toString()
  return `data:${mediaType};base64,${Buffer.from(data).toString('base64')}`
}

const convertMessage = (message: LanguageModelV3Prompt[number]) => {
  switch (message.role) {
    case 'system':
      return { role: 'system' as const, content: message.content }
    case 'user':
      return {
        role: 'user' as const,
        content: message.content.map((part) =>
          part.type === 'text'
            ? { type: 'text' as const, text: part.text }
            : { type: 'image_url' as const, image_url: { url: toDataUrl(part) } },
        ),
      }
    case 'assistant':
      return {
        role: 'assistant' as const,
        content: message.content
          .filter((p) => p.type === 'text')
          .map((p) => p.text)
          .join(''),
      }
    case 'tool':
      return null // Arc backend doesn't support tool messages
  }
}

const convertToArcMessages = (prompt: LanguageModelV3Prompt) =>
  prompt.map(convertMessage).filter((m) => m !== null)

function convertToSdkUsage(usage: ArcChatChunk['usage']): LanguageModelV3Usage {
  return {
    inputTokens: {
      total: usage?.prompt_tokens ?? undefined,
      noCache: undefined,
      cacheRead: undefined,
      cacheWrite: undefined,
    },
    outputTokens: {
      total: usage?.completion_tokens ?? undefined,
      text: undefined,
      reasoning: usage?.completion_tokens_details?.reasoning_tokens ?? undefined,
    },
  }
}

function mapFinishReason(reason: string | null | undefined): LanguageModelV3FinishReason {
  switch (reason) {
    case 'stop':
      return { unified: 'stop', raw: reason }
    case 'length':
      return { unified: 'length', raw: reason }
    case 'content_filter':
      return { unified: 'content-filter', raw: reason }
    case 'tool_calls':
      return { unified: 'tool-calls', raw: reason }
    default:
      return { unified: 'other', raw: reason ?? undefined }
  }
}

// ============================================================================
// SECTION 3: STREAM TRANSFORMER (from lib/ai/stream.ts)
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
  usage: convertToSdkUsage(undefined),
}

type ChunkParseResult = ParseResult<ArcChatChunk>

function* processChunk(chunk: ChunkParseResult, state: StreamState): Generator<LanguageModelV3StreamPart, StreamState> {
  if (chunk.success === false) {
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
    next = { ...next, usage: convertToSdkUsage(value.usage) }
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

function* flushStream(state: StreamState): Generator<LanguageModelV3StreamPart> {
  if (state.reasoningActive) {
    yield { type: 'reasoning-end', id: 'reasoning-0' }
  }
  if (state.textActive) {
    yield { type: 'text-end', id: 'text-0' }
  }
  yield { type: 'finish', finishReason: state.finishReason, usage: state.usage }
}

function createChunkTransformer() {
  let state = initialStreamState

  return new TransformStream<ChunkParseResult, LanguageModelV3StreamPart>({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] })
    },
    transform(chunk, controller) {
      const gen = processChunk(chunk, state)
      let result = gen.next()
      while (!result.done) {
        controller.enqueue(result.value as LanguageModelV3StreamPart)
        result = gen.next()
      }
      state = result.value as StreamState
    },
    flush(controller) {
      const gen = flushStream(state)
      let result = gen.next()
      while (!result.done) {
        controller.enqueue(result.value)
        result = gen.next()
      }
    },
  })
}

// ============================================================================
// SECTION 4: PROVIDER (from lib/ai/provider.ts)
// ============================================================================

type ArcLanguageModelConfig = {
  provider: string
  baseURL: string
  headers: () => Record<string, string | undefined>
  fetch?: FetchFunction
}

class ArcLanguageModel implements LanguageModelV3 {
  readonly specificationVersion = 'v3'
  readonly modelId: string
  readonly provider: string
  readonly supportedUrls = {}

  private readonly config: ArcLanguageModelConfig

  constructor(modelId: string, config: ArcLanguageModelConfig) {
    this.modelId = modelId
    this.provider = config.provider
    this.config = config
  }

  async doGenerate(): Promise<never> {
    throw new UnsupportedFunctionalityError({ functionality: 'doGenerate' })
  }

  async doStream(options: LanguageModelV3CallOptions): Promise<LanguageModelV3StreamResult> {
    const body = await this.buildRequestBody(options)

    const { responseHeaders, value: response } = await postJsonToApi({
      url: `${this.config.baseURL}/chat/completions`,
      headers: combineHeaders(this.config.headers(), options.headers),
      body,
      failedResponseHandler: arcErrorHandler,
      successfulResponseHandler: arcStreamHandler,
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    })

    return {
      stream: response.pipeThrough(createChunkTransformer()),
      request: { body },
      response: { headers: responseHeaders },
    }
  }

  private async buildRequestBody(options: LanguageModelV3CallOptions) {
    const providerOptions = await parseProviderOptions({
      provider: 'arc',
      providerOptions: options.providerOptions,
      schema: ArcProviderOptionsSchema,
    })

    return {
      model: this.modelId,
      messages: convertToArcMessages(options.prompt),
      stream: true,
      ...(options.maxOutputTokens !== undefined && { max_tokens: options.maxOutputTokens }),
      ...(options.temperature !== undefined && { temperature: options.temperature }),
      ...(options.topP !== undefined && { top_p: options.topP }),
      ...(options.stopSequences !== undefined && { stop: options.stopSequences }),
      ...(providerOptions?.reasoningEffort && {
        reasoning_effort: providerOptions.reasoningEffort,
        thinking: { reasoning_effort: providerOptions.reasoningEffort },
      }),
    }
  }
}

type ArcProviderSettings = {
  baseURL?: string
  apiKey?: string
  headers?: Record<string, string>
  fetch?: FetchFunction
}

function createArc(settings: ArcProviderSettings = {}) {
  const baseURL = settings.baseURL ?? 'https://api.openai.com/v1'

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    ...(settings.apiKey && { Authorization: `Bearer ${settings.apiKey}` }),
    ...settings.headers,
  })

  return (modelId: string) =>
    new ArcLanguageModel(modelId, {
      provider: 'arc.chat',
      baseURL,
      headers: getHeaders,
      fetch: settings.fetch,
    })
}

// ============================================================================
// SECTION 5: HTTP CLIENT (from lib/ai/client.ts)
// ============================================================================

type ClientSettings = {
  baseUrl?: string | null
  apiKey?: string | null
}

function createClient(settings: ClientSettings) {
  const baseURL = settings.baseUrl ?? 'https://api.openai.com/v1'

  return {
    async listModels() {
      const response = await fetch(`${baseURL}/models`, {
        headers: {
          'Content-Type': 'application/json',
          ...(settings.apiKey && { Authorization: `Bearer ${settings.apiKey}` }),
        },
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText)
        throw new Error(`Failed to list models: ${errorText}`)
      }

      const data = (await response.json()) as { data: Array<{ id: string }> }
      return data.data
    },
  }
}

// ============================================================================
// SECTION 6: DOMAIN TYPES
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
// SECTION 7: STREAM STATE
// ============================================================================

const activeStreams = new Map<string, AbortController>()

// ============================================================================
// SECTION 8: USAGE CONVERSION (domain-level)
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
// SECTION 9: STREAM CONSUMPTION
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
// SECTION 10: REFINE META PROMPT
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
// SECTION 11: PUBLIC API
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
