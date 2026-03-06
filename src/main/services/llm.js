import { generateId, streamText as aiStreamText, convertToModelMessages } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'

const clientFactories = {
  anthropic: (p) => createAnthropic({
    baseURL: p.baseUrl,
    apiKey: p.apiKey,
    headers: { Authorization: `Bearer ${p.apiKey}` },
  }),
  openai: (p) => createOpenAI({
    baseURL: p.baseUrl,
    apiKey: p.apiKey,
  }),
}

export const streamText = async ({ provider, modelId, system, messages, send, signal }) => {
  const assistantId = generateId()
  const model = clientFactories[provider.type](provider)(modelId)
  const modelMessages = await convertToModelMessages(messages)

  const providerOptions = provider.type === 'anthropic'
    ? { anthropic: { thinking: { type: 'enabled', budgetTokens: 10000 } } }
    : undefined

  const result = aiStreamText({
    model,
    system,
    messages: modelMessages,
    abortSignal: signal,
    ...(providerOptions && { providerOptions }),
  })

  try {
    for await (const chunk of result.toUIMessageStream({
      sendReasoning: true,
      generateMessageId: () => assistantId,
    })) {
      send(chunk)
    }
  } catch (e) {
    send({ type: 'error', errorText: e.message ?? 'Streaming failed' })
    return null
  }

  if (signal.aborted) return null
  const [text, reasoning] = await Promise.all([result.text, result.reasoning])
  return { assistantId, text, reasoning }
}
