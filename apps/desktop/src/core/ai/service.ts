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
  if (!config.apiKey) {
    throw new Error('API key not configured for provider')
  }

  switch (config.type) {
    case 'openai':
      // Official OpenAI provider
      return createOpenAI({
        apiKey: config.apiKey,
      })(modelId)

    case 'openai-compatible':
      // OpenAI-compatible provider with custom base URL
      if (!config.baseUrl) {
        throw new Error('Base URL required for OpenAI-compatible provider')
      }
      return createOpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseUrl,
      })(modelId)

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
  const model = createProviderModel(providerConfig, modelId)

  const result = streamText({
    model,
    messages,
    abortSignal: signal,
  })

  return result
}
