import { withApp } from '@cli/bootstrap.js'
import { getProvider } from '@main/services/provider.js'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { streamText } from 'ai'

const [providerId] = process.argv.slice(2)
if (!providerId) {
  console.error('Usage: npm run task -- scripts/test-proxy.js <providerId>')
  process.exit(1)
}

const defaultModels = { anthropic: 'claude-sonnet-4-6', openai: 'gpt-5' }

const bar = (label) => `═══ ${label} ${'═'.repeat(Math.max(3, 50 - label.length))}`

const SECRET_KEYS = new Set(['authorization', 'x-api-key', 'api-key'])
const RESPONSE_HEADERS = new Set(['content-type', 'server'])

function maskSecret(val) {
  return val.replace(/[A-Za-z0-9_-]{12,}/g, m => m.slice(0, 4) + '****' + m.slice(-3))
}

function printHeaders(obj, { only, mask } = {}) {
  let entries = Object.entries(obj)
  if (only) entries = entries.filter(([k]) => only.has(k.toLowerCase()))
  if (!entries.length) return
  const pad = Math.max(...entries.map(([k]) => k.length))
  for (const [k, v] of entries) {
    const display = mask && SECRET_KEYS.has(k.toLowerCase()) ? maskSecret(v) : v
    console.log(`${k.padEnd(pad)}  ${display}`)
  }
}

// ── SSE stream reading ──────────────────────────────────────────────────

function readSseStream(readable, handle) {
  return (async () => {
    const reader = readable.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop()
        for (const ln of lines) {
          const t = ln.trim()
          if (t.startsWith('data:')) handle(t.slice(5).trim())
        }
      }
      const t = buf.trim()
      if (t.startsWith('data:')) handle(t.slice(5).trim())
    } catch (e) { console.error(`  ⚠ stream error: ${e.message}`) }
  })()
}

// ── Anthropic SSE parser ────────────────────────────────────────────────

function parseAnthropicSseStream(readable) {
  let accumulated = ''

  const flush = () => {
    if (!accumulated) return
    for (const line of accumulated.split('\n')) console.log(`  ┈ ${line}`)
    accumulated = ''
  }

  return readSseStream(readable, (data) => {
    let p
    try { p = JSON.parse(data) }
    catch { return console.log(`  ⚠ bad JSON: ${data.slice(0, 120)}`) }

    switch (p.type) {
      case 'message_start': {
        const m = p.message
        console.log('● message_start')
        console.log(`  model: ${m.model}`)
        console.log(`  id:    ${m.id}`)
        if (m.usage) {
          const u = m.usage
          console.log(`  usage: { input: ${u.input_tokens}, cache_create: ${u.cache_creation_input_tokens ?? 0}, cache_read: ${u.cache_read_input_tokens ?? 0} }`)
        }
        console.log()
        break
      }
      case 'content_block_start':
        accumulated = ''
        console.log(`● content_block_start [${p.index}] ${p.content_block?.type ?? '?'}`)
        break
      case 'content_block_delta': {
        const d = p.delta
        if (d.type === 'thinking_delta') accumulated += d.thinking
        else if (d.type === 'text_delta') accumulated += d.text
        break
      }
      case 'content_block_stop':
        flush()
        console.log(`● content_block_stop [${p.index}]\n`)
        break
      case 'message_delta':
        console.log('● message_delta')
        if (p.delta?.stop_reason) console.log(`  stop_reason: ${p.delta.stop_reason}`)
        if (p.usage) console.log(`  usage: { output: ${p.usage.output_tokens} }`)
        console.log()
        break
      case 'message_stop':
        console.log('● message_stop')
        break
      default:
        console.log(`  ⚠ ${p.type}: ${data.slice(0, 120)}`)
    }
  })
}

// ── OpenAI Responses API SSE parser ─────────────────────────────────────

function parseOpenAiSseStream(readable) {
  let text = ''
  let reasoning = ''

  const flush = (label, buf) => {
    if (!buf) return
    for (const line of buf.split('\n')) console.log(`  ┈ ${line}`)
  }

  return readSseStream(readable, (data) => {
    let p
    try { p = JSON.parse(data) }
    catch { return console.log(`  ⚠ bad JSON: ${data.slice(0, 120)}`) }

    switch (p.type) {
      case 'response.created': {
        const r = p.response
        console.log('● response.created')
        console.log(`  model: ${r.model}`)
        console.log(`  id:    ${r.id}`)
        console.log()
        break
      }
      case 'response.output_item.added':
        console.log(`● output_item.added [${p.output_index}] ${p.item?.type ?? '?'}`)
        if (p.item?.type === 'message') text = ''
        if (p.item?.type === 'reasoning') reasoning = ''
        break
      case 'response.output_text.delta':
        text += p.delta
        break
      case 'response.reasoning_summary_text.delta':
        reasoning += p.delta
        break
      case 'response.reasoning_summary_part.added':
        reasoning = ''
        console.log(`● reasoning_summary_part.added [${p.summary_index}]`)
        break
      case 'response.reasoning_summary_part.done':
        flush('reasoning', reasoning)
        console.log(`● reasoning_summary_part.done [${p.summary_index}]\n`)
        reasoning = ''
        break
      case 'response.output_item.done': {
        const item = p.item
        if (item?.type === 'message') flush('text', text)
        console.log(`● output_item.done [${p.output_index}] ${item?.type ?? '?'}\n`)
        break
      }
      case 'response.completed':
      case 'response.incomplete': {
        const u = p.response?.usage
        console.log(`● ${p.type}`)
        if (u) {
          const reasoning_tokens = u.output_tokens_details?.reasoning_tokens ?? 0
          console.log(`  usage: { input: ${u.input_tokens}, output: ${u.output_tokens}, reasoning: ${reasoning_tokens} }`)
        }
        if (p.response?.incomplete_details) console.log(`  incomplete: ${p.response.incomplete_details.reason}`)
        console.log()
        break
      }
      case 'response.function_call_arguments.delta':
        break
      default:
        console.log(`  ⚠ ${p.type}: ${data.slice(0, 120)}`)
    }
  })
}

// ── OpenAI Chat Completions SSE parser ──────────────────────────────────

function parseChatCompletionsSseStream(readable) {
  let text = ''
  let logged = false

  const flush = () => {
    if (!text) return
    for (const line of text.split('\n')) console.log(`  ┈ ${line}`)
    text = ''
  }

  return readSseStream(readable, (data) => {
    if (data === '[DONE]') {
      flush()
      console.log('● [DONE]')
      return
    }
    let p
    try { p = JSON.parse(data) }
    catch { return console.log(`  ⚠ bad JSON: ${data.slice(0, 120)}`) }

    if (!logged) {
      logged = true
      console.log(`● chat.completion.chunk`)
      console.log(`  model: ${p.model}`)
      console.log(`  id:    ${p.id}`)
      console.log()
    }
    const choice = p.choices?.[0]
    if (choice?.delta?.content) text += choice.delta.content
    if (choice?.finish_reason) {
      flush()
      console.log(`● finish_reason: ${choice.finish_reason}`)
    }
    if (p.usage?.prompt_tokens != null) {
      console.log(`  usage: { input: ${p.usage.prompt_tokens}, output: ${p.usage.completion_tokens} }`)
      console.log()
    }
  })
}

// ── logging fetch wrapper ───────────────────────────────────────────────

let sseComplete = Promise.resolve()
let activeParserType = 'anthropic'

const sseParsers = {
  anthropic: parseAnthropicSseStream,
  openai: parseOpenAiSseStream,
  'openai-chat': parseChatCompletionsSseStream,
}

async function loggingFetch(url, init) {
  console.log(`\n${bar('REQUEST')}`)
  console.log(`${init.method || 'POST'} ${url}`)
  printHeaders({ ...init.headers }, { mask: true })
  if (init.body) {
    console.log()
    try { console.log(JSON.stringify(JSON.parse(init.body), null, 2)) }
    catch { console.log(init.body) }
  }

  const res = await fetch(url, init)

  console.log(`\n${bar(`RESPONSE ${res.status} ${res.statusText}`)}`)
  printHeaders(Object.fromEntries(res.headers.entries()), { only: RESPONSE_HEADERS })

  if (!res.body) return res

  const [forLog, forSdk] = res.body.tee()

  console.log(`\n${bar('SSE STREAM')}`)
  sseComplete = (sseParsers[activeParserType] ?? parseAnthropicSseStream)(forLog)

  return new Response(forSdk, { status: res.status, statusText: res.statusText, headers: res.headers })
}

// ── main ────────────────────────────────────────────────────────────────

withApp(async () => {
  const provider = await getProvider(providerId)
  if (!provider) {
    console.error(`Provider not found: ${providerId}`)
    return
  }

  const modelId = defaultModels[provider.type]
  if (!modelId) {
    console.error(`Unsupported provider type: ${provider.type}`)
    return
  }

  console.log(`Using provider "${provider.name}" (${provider.type}) → model ${modelId}`)

  const openaiClient = provider.type === 'openai'
    ? createOpenAI({ baseURL: provider.baseUrl, apiKey: provider.apiKey, fetch: loggingFetch })
    : null

  const clientFactories = {
    anthropic: (p) => createAnthropic({
      baseURL: p.baseUrl,
      apiKey: p.apiKey,
      headers: { Authorization: `Bearer ${p.apiKey}` },
      fetch: loggingFetch,
    }),
    openai: () => openaiClient,
  }

  const prompt = 'What is 27 * 453? Think step by step.'

  async function runStream(model, { providerOptions } = {}) {
    const result = streamText({
      model,
      prompt,
      maxOutputTokens: 8000,
      ...(providerOptions && { providerOptions }),
    })

    const [text, reasoning, finishReason, usage] = await Promise.all([
      result.text, result.reasoningText, result.finishReason, result.usage,
    ])
    await sseComplete

    console.log(`\n${bar('SDK PARSED')}`)
    console.log(`finish: ${finishReason}`)
    if (usage) console.log(`usage:  { input: ${usage.promptTokens}, output: ${usage.completionTokens} }`)

    console.log('\n── reasoning ──')
    console.log(reasoning || '(none)')

    console.log('\n── text ──')
    console.log(text || '(none)')

    return { text, finishReason }
  }

  const providerOptionsByType = {
    anthropic: { anthropic: { thinking: { type: 'enabled', budgetTokens: 5000 } } },
    openai: { openai: { reasoningEffort: 'low', reasoningSummary: 'auto' } },
  }

  try {
    activeParserType = provider.type
    const client = clientFactories[provider.type](provider)
    const model = client(modelId)
    const providerOptions = providerOptionsByType[provider.type]

    const { text, finishReason } = await runStream(model, { providerOptions })

    // Auto-fallback: Responses API returned empty → retry with Chat Completions
    if (provider.type === 'openai' && !text && finishReason === 'other') {
      console.log(`\n${bar('FALLBACK → Chat Completions API')}`)
      activeParserType = 'openai-chat'
      const chatModel = openaiClient.chat(modelId)
      await runStream(chatModel)
    }

    console.log(`\n${bar('DONE')}`)
  } catch (e) {
    console.error(`\n${bar('ERROR')}`)
    console.error(e.message)
    if (e.responseBody) console.error('body:', e.responseBody)
  }

  process.exit(0)
})
