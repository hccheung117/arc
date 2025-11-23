import { createOpenAI } from '@ai-sdk/openai'
import { streamText, type CoreMessage, type LanguageModel } from 'ai'
import { eq } from 'drizzle-orm'
import type { Message } from '@arc-types/messages'
import { db } from '@main/db/client'
import { models as modelsTable, providers } from '@main/db/schema'
import { getMessages, insertAssistantMessage } from './messages'
import { getProviderConfig } from './providers'

export interface ProviderConfig {
  type: string
  apiKey: string | null
  baseUrl: string | null
}

export interface StreamCallbacks {
  onDelta: (chunk: string) => void
  onComplete: (message: Message) => void
  onError: (error: string) => void
}

const activeStreams = new Map<string, AbortController>()

/**
 * Create an AI SDK language model for the given provider configuration
 */
export function createProviderModel(
  config: ProviderConfig,
  modelId: string,
): LanguageModel {
  switch (config.type) {
    case 'openai':
      return createOpenAI({
        ...(config.apiKey && { apiKey: config.apiKey }),
        ...(config.baseUrl && { baseURL: config.baseUrl }),
      }).chat(modelId)

    default:
      throw new Error(`Unsupported provider type: ${config.type}`)
  }
}

/**
 * Convert database messages to AI SDK CoreMessage format
 */
export function toCoreMessages(messages: Message[]): CoreMessage[] {
  return messages.map((message) => ({
    role: message.role as 'user' | 'assistant' | 'system',
    content: message.content,
  }))
}

/**
 * Get provider ID for a given model.
 */
export async function getModelProvider(modelId: string): Promise<string> {
  const result = await db
    .select({ providerId: modelsTable.providerId })
    .from(modelsTable)
    .where(eq(modelsTable.id, modelId))
    .get()

  if (!result) {
    throw new Error(`Model ${modelId} not found`)
  }

  return result.providerId
}

/**
 * Stream chat completion with the AI provider (low-level)
 */
export async function streamChatCompletion(
  providerConfig: ProviderConfig,
  modelId: string,
  messages: CoreMessage[],
  signal?: AbortSignal,
) {
  const endpoint = `${providerConfig.baseUrl || 'https://api.openai.com/v1'}/chat/completions`
  console.log(`[API] POST ${endpoint} ${modelId} (${messages.length} msgs)`)

  const model = createProviderModel(providerConfig, modelId)

  try {
    const result = streamText({
      model,
      messages,
      abortSignal: signal,
    })

    return result
  } catch (error) {
    if (error instanceof Error) {
      const apiError = error as Error & { statusCode?: number; responseBody?: string }
      if (apiError.statusCode) {
        console.error(`[API] ${apiError.statusCode} ${apiError.responseBody || error.message}`)
      } else {
        console.error(`[API] Error: ${error.message}`)
      }
    }
    throw error
  }
}

/**
 * Start AI chat stream with callbacks.
 * This is the high-level streaming function that handles the full flow:
 * fetch messages → get provider config → stream → save result.
 *
 * @returns streamId for tracking/cancellation
 */
export async function startChatStream(
  streamId: string,
  conversationId: string,
  modelId: string,
  callbacks: StreamCallbacks
): Promise<void> {
  const abortController = new AbortController()
  activeStreams.set(streamId, abortController)

  try {
    const conversationMessages = await getMessages(conversationId)

    const providerId = await getModelProvider(modelId)
    const config = await getProviderConfig(providerId)
    const provider = await db
      .select({ type: providers.type })
      .from(providers)
      .where(eq(providers.id, providerId))
      .get()

    if (!provider) {
      throw new Error(`Provider ${providerId} not found`)
    }

    const providerConfig: ProviderConfig = {
      type: provider.type,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
    }

    const coreMessages = toCoreMessages(conversationMessages)
    const result = await streamChatCompletion(
      providerConfig,
      modelId,
      coreMessages,
      abortController.signal
    )

    let fullContent = ''

    for await (const textPart of result.textStream) {
      fullContent += textPart
      callbacks.onDelta(textPart)
    }

    const assistantMessage = await insertAssistantMessage(conversationId, fullContent)
    callbacks.onComplete(assistantMessage)
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      return
    }

    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[arc:ai:chat] Stream error: ${errorMsg}`)
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
