import { generateId, generateText as aiGenerateText, streamText as aiStreamText, convertToModelMessages } from 'ai'
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

const clientFor = (provider) => clientFactories[provider.type](provider)
const modelFor = (provider, modelId) => clientFor(provider)(modelId)

export const generateText = async ({ provider, modelId, ...opts }) => {
  const model = modelFor(provider, modelId)
  try {
    const result = await aiGenerateText({ model, ...opts })
    return { text: result.text }
  } catch {
    // Some proxies return non-standard fields (e.g. citations: null) that
    // fail the SDK's strict response schema validation. Stream-based collection
    // bypasses full-response validation and works with these proxies.
    const result = aiStreamText({ model, ...opts })
    return { text: await result.text }
  }
}

export const streamText = async ({ provider, modelId, system, messages, send, signal }) => {
  const assistantId = generateId()
  const model = modelFor(provider, modelId)
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
