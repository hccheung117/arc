import { generateId, generateText as aiGenerateText, streamText as aiStreamText, convertToModelMessages, wrapLanguageModel, ToolLoopAgent } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { app } from 'electron'
import { resolveArcfsUrls } from './message.js'

// LLM text parts often carry leading/trailing whitespace and blank lines
// from the model stream. Trim at the source so all downstream consumers
// (rendering, export, edit prefill) receive clean text without per-site cleanup.
const cleanParts = (steps) => steps.flatMap(step => step.content)
  .map(p => p.type === 'text' ? { ...p, text: p.text.trim() } : p)
  .filter(p => p.type !== 'text' || p.text)

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
  google: (p) => createGoogleGenerativeAI({
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
    return { openaiCompatible: { reasoningEffort: 'high' } }
  if (provider.type === 'google')
    return { google: { thinkingConfig: { includeThoughts: true, thinkingLevel: 'high' } } }
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

// Single-turn streaming (no tools). Used by refinePrompt, etc.
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
    // toUIMessageStream consumed the stream above, so steps resolves immediately.
    // step.content is a unified array of text, reasoning, and source parts.
    const steps = await result.steps
    const parts = cleanParts(steps)
    return { assistantId, parts }
  } catch (e) {
    send({ type: 'error', errorText: e.message ?? 'No response generated' })
    return null
  }
}

// Multi-turn streaming with tool loop. Used by session:send.
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
    // step.content includes text, reasoning, tool-call, and tool-result parts
    const steps = await result.steps
    const parts = cleanParts(steps)
    return { assistantId, parts }
  } catch (e) {
    send({ type: 'error', errorText: e.message ?? 'No response generated' })
    return null
  }
}
