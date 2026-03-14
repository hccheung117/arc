import { generateId, generateText as aiGenerateText, streamText as aiStreamText, convertToModelMessages, wrapLanguageModel, ToolLoopAgent } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { app } from 'electron'
import { resolveArcfsUrls } from './message.js'

const clientFactories = {
  anthropic: (p) => createAnthropic({
    baseURL: p.baseUrl,
    apiKey: p.apiKey,
    headers: { Authorization: `Bearer ${p.apiKey}` },
  }),
  'openai-compatible': (p) => createOpenAICompatible({
    name: p.name,
    baseURL: p.baseUrl,
    apiKey: p.apiKey,
  }),
}

const clientFor = (provider) => clientFactories[provider.type](provider)
const modelFor = async (provider, modelId) => {
  const model = clientFor(provider)(modelId)
  if (app.isPackaged) return model
  const { devToolsMiddleware } = await import('@ai-sdk/devtools')
  return wrapLanguageModel({ model, middleware: devToolsMiddleware() })
}

const prepareMessages = async (messages) => {
  const resolved = await resolveArcfsUrls(messages)
  return convertToModelMessages(resolved)
}

const thinkingOptions = (provider, thinking) => {
  if (!thinking) return undefined
  if (provider.type === 'anthropic')
    // budget_tokens must be < max_tokens; lowest model default is 32K (Opus 4/4.1)
    return { anthropic: { thinking: { type: 'enabled', budgetTokens: 31999 }, effort: 'high' } }
  if (provider.type === 'openai-compatible')
    return { [provider.name]: { reasoningEffort: 'high' } }
}

const loop = new ToolLoopAgent({
  model: null,
  stopWhen: () => false,
  prepareCall: ({ options, ...rest }) => ({
    ...rest,
    model: options.model,
    instructions: options.system,
    ...(options.tools && { tools: options.tools }),
    ...(options.providerOptions && { providerOptions: options.providerOptions }),
  }),
})

export const generateText = async ({ provider, modelId, messages, ...opts }) => {
  const model = await modelFor(provider, modelId)
  const prepared = messages ? { messages: await prepareMessages(messages) } : {}
  try {
    const result = await aiGenerateText({ model, ...prepared, ...opts })
    return { text: result.text }
  } catch {
    // Some proxies return non-standard fields (e.g. citations: null) that
    // fail the SDK's strict response schema validation. Stream-based collection
    // bypasses full-response validation and works with these proxies.
    const result = aiStreamText({ model, ...prepared, ...opts })
    return { text: await result.text }
  }
}

export const streamText = async ({ provider, modelId, system, messages, send, signal, thinking = false }) => {
  const assistantId = generateId()
  const model = await modelFor(provider, modelId)
  const modelMessages = await prepareMessages(messages)

  const providerOptions = thinkingOptions(provider, thinking)

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
  try {
    const [text, reasoning] = await Promise.all([result.text, result.reasoning])
    return { assistantId, text, reasoning }
  } catch (e) {
    send({ type: 'error', errorText: e.message ?? 'No response generated' })
    return null
  }
}

export const stream = async ({ provider, modelId, system, messages, tools, send, signal, thinking = false }) => {
  const assistantId = generateId()
  const model = await modelFor(provider, modelId)
  const modelMessages = await prepareMessages(messages)
  const providerOptions = thinkingOptions(provider, thinking)

  const result = await loop.stream({
    messages: modelMessages,
    options: { model, system, tools, providerOptions },
    abortSignal: signal,
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
  try {
    const [text, steps] = await Promise.all([result.text, result.steps])
    const toolParts = steps.flatMap(step => [...step.toolCalls, ...step.toolResults])
    const reasoning = steps.flatMap(step => step.reasoning)
    return { assistantId, text, reasoning, toolParts }
  } catch (e) {
    send({ type: 'error', errorText: e.message ?? 'No response generated' })
    return null
  }
}
