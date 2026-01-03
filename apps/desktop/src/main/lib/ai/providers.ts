/**
 * AI Provider Factories
 *
 * Creates provider configurations for OpenAI-compatible APIs.
 * Single source of truth for default resolution.
 */

const OPENAI_BASE_URL = 'https://api.openai.com/v1'

export function resolveOpenAI(config: {
  baseUrl?: string | null
  apiKey?: string | null
} = {}) {
  return {
    baseUrl: config.baseUrl ?? OPENAI_BASE_URL,
    apiKey: config.apiKey ?? null,
  }
}

export function createOpenAI(config: {
  baseUrl?: string | null
  apiKey?: string | null
} = {}) {
  const { baseUrl, apiKey } = resolveOpenAI(config)
  return (modelId: string) => ({
    id: modelId,
    baseUrl,
    apiKey: apiKey ?? undefined,
  })
}

