import OpenAI from 'openai'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'

export { OpenAI }
export type {
  ChatCompletionMessageParam,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionMessage,
} from 'openai/resources/chat/completions'

export interface StreamChatOptions {
  model: string
  apiKey: string
  baseUrl?: string
}

export async function* streamChat(
  messages: ChatCompletionMessageParam[],
  options: StreamChatOptions,
): AsyncGenerator<string> {
  const client = new OpenAI({
    apiKey: options.apiKey,
    baseURL: options.baseUrl,
    dangerouslyAllowBrowser: true,
  })

  const stream = await client.chat.completions.create({
    model: options.model,
    messages,
    stream: true,
  })

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content
    if (content) {
      yield content
    }
  }
}
