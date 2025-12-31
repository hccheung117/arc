/**
 * AI Streaming
 *
 * Pure streaming function for OpenAI-compatible chat completions.
 */

import type { StreamOptions, StreamEvent, Usage, FinishReason } from './types'
import { parseSSE, normalizeUsage, normalizeFinishReason } from './utils'

const DEFAULT_BASE_URL = 'https://api.openai.com/v1'

export async function* streamText(options: StreamOptions): AsyncGenerator<StreamEvent> {
  const { baseUrl = DEFAULT_BASE_URL, apiKey, model, messages, temperature, reasoningEffort, signal } = options

  const body: Record<string, unknown> = {
    model,
    messages,
    stream: true,
  }

  if (temperature !== undefined) {
    body.temperature = temperature
  }

  if (reasoningEffort) {
    body.thinking = { reasoning_effort: reasoningEffort }
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
    },
    body: JSON.stringify(body),
    signal,
  })

  if (!response.ok) {
    let message = `HTTP ${response.status}: ${response.statusText}`
    try {
      const err = (await response.json()) as { error?: { message?: string } }
      if (err.error?.message) message = err.error.message
    } catch {
      // Use default message
    }
    throw new Error(message)
  }

  if (!response.body) {
    throw new Error('Response body is null')
  }

  let usage: Usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
  let finishReason: FinishReason = 'unknown'

  for await (const chunk of parseSSE(response.body)) {
    const delta = chunk.choices[0]?.delta

    if (delta?.reasoning_content) {
      yield { type: 'reasoning', delta: delta.reasoning_content }
    }

    if (delta?.content) {
      yield { type: 'content', delta: delta.content }
    }

    if (chunk.choices[0]?.finish_reason) {
      finishReason = normalizeFinishReason(chunk.choices[0].finish_reason)
    }

    if (chunk.usage) {
      usage = normalizeUsage(chunk.usage)
    }
  }

  yield { type: 'usage', usage }
  yield { type: 'done', finishReason }
}
