import { createOpenAI } from '@ai-sdk/openai'
import { streamText, type CoreMessage, type LanguageModel } from 'ai'
import * as fs from 'fs/promises'
import type { Message } from '@arc-types/messages'
import { modelsFile, settingsFile } from '@main/storage'
import { getAttachmentPath } from './attachments'
import { getMessages, insertAssistantMessage } from './messages'
import { getProviderConfig } from './providers'

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
 * Create an AI SDK language model for the given provider configuration
 */
export function createProviderModel(
  config: ProviderConfig,
  modelId: string,
): LanguageModel {
  return createOpenAI({
    ...(config.apiKey && { apiKey: config.apiKey }),
    ...(config.baseUrl && { baseURL: config.baseUrl }),
  }).chat(modelId)
}

/**
 * Convert database messages to AI SDK CoreMessage format.
 * Handles multimodal content when user messages have image attachments.
 * Only user role supports multimodal content in the AI SDK.
 *
 * Reads attachment files as Buffer directly - AI SDK accepts Buffer without
 * base64 encoding overhead.
 */
export async function toCoreMessages(
  messages: Message[],
  conversationId: string,
): Promise<CoreMessage[]> {
  return Promise.all(
    messages.map(async (message): Promise<CoreMessage> => {
      // Only user messages can have multimodal content
      if (message.role === 'user' && message.attachments?.length) {
        const imageParts = await Promise.all(
          message.attachments.map(async (att) => ({
            type: 'image' as const,
            image: await fs.readFile(getAttachmentPath(conversationId, att.path)),
            mediaType: att.mimeType,
          })),
        )
        return {
          role: 'user',
          content: [...imageParts, { type: 'text' as const, text: message.content }],
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
 * Stream chat completion with the AI provider (low-level)
 */
export async function streamChatCompletion(
  providerConfig: ProviderConfig,
  modelId: string,
  messages: CoreMessage[],
  signal?: AbortSignal,
) {
  const endpoint = `${providerConfig.baseUrl || 'https://api.openai.com/v1'}/chat/completions`
  const temperature = 0
  const reasoningEffort = 'high'
  console.log(`[API] POST ${endpoint} ${modelId} (${messages.length} msgs) temp=${temperature} reasoning=${reasoningEffort}`)

  const model = createProviderModel(providerConfig, modelId)

  try {
    const result = streamText({
      model,
      messages,
      abortSignal: signal,
      temperature,
      providerOptions: {
        openai: { reasoningEffort },
      },
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
    const settings = await settingsFile().read()
    const provider = settings.providers.find((p) => p.id === providerId)

    if (!provider) {
      throw new Error(`Provider ${providerId} not found`)
    }

    const providerConfig: ProviderConfig = {
      type: provider.type,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
    }

    const coreMessages = await toCoreMessages(conversationMessages, conversationId)
    const result = await streamChatCompletion(
      providerConfig,
      modelId,
      coreMessages,
      abortController.signal
    )

    let fullContent = ''
    let fullReasoning = ''
    let reasoningStarted = false

    for await (const part of result.fullStream) {
      if (part.type === 'reasoning-delta') {
        if (!reasoningStarted) {
          console.log(`[AI] Reasoning started`)
          reasoningStarted = true
        }
        fullReasoning += part.text
        callbacks.onReasoning(part.text)
      } else if (part.type === 'text-delta') {
        if (reasoningStarted && fullContent === '') {
          console.log(`[AI] Reasoning complete (${fullReasoning.length} chars), response started`)
        }
        fullContent += part.text
        callbacks.onDelta(part.text)
      }
    }

    const usage = await result.usage

    const assistantMessage = await insertAssistantMessage(
      conversationId,
      fullContent,
      fullReasoning || undefined,
      modelId,
      providerId,
      usage,
    )
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
