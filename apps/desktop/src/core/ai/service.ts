import { createOpenAI } from '@ai-sdk/openai'
import { streamText, type CoreMessage, type LanguageModel } from 'ai'
import type { Message } from '@arc/contracts/src/messages'

export interface ProviderConfig {
  type: string
  apiKey: string | null
  baseUrl: string | null
}

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
 * Stream chat completion with the AI provider
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
      const apiError = error as any
      if (apiError.statusCode) {
        console.error(`[API] ${apiError.statusCode} ${apiError.responseBody || error.message}`)
      } else {
        console.error(`[API] Error: ${error.message}`)
      }
    }
    throw error
  }
}
