/**
 * Arc Custom Provider for AI SDK
 *
 * Implements LanguageModelV3 for Arc's custom backend format:
 * - Request: `{ reasoning_effort, thinking: { reasoning_effort } }` (both nested and unnested)
 * - Response: `reasoning_content ?? reasoning` fallback
 */

import {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3StreamResult,
  UnsupportedFunctionalityError,
} from '@ai-sdk/provider'
import {
  combineHeaders,
  FetchFunction,
  parseProviderOptions,
  postJsonToApi,
} from '@ai-sdk/provider-utils'
import { arcStreamHandler, arcErrorHandler, arcProviderOptionsSchema } from '@boundary/ai'
import { convertToArcMessages } from './convert'
import { createChunkTransformer } from './stream'

// ============================================================================
// LANGUAGE MODEL
// ============================================================================

type ArcLanguageModelConfig = {
  provider: string
  baseURL: string
  headers: () => Record<string, string | undefined>
  fetch?: FetchFunction
}

class ArcLanguageModel implements LanguageModelV3 {
  readonly specificationVersion = 'v3'
  readonly modelId: string
  readonly provider: string
  readonly supportedUrls = {}

  private readonly config: ArcLanguageModelConfig

  constructor(modelId: string, config: ArcLanguageModelConfig) {
    this.modelId = modelId
    this.provider = config.provider
    this.config = config
  }

  async doGenerate(): Promise<never> {
    throw new UnsupportedFunctionalityError({ functionality: 'doGenerate' })
  }

  async doStream(options: LanguageModelV3CallOptions): Promise<LanguageModelV3StreamResult> {
    const body = await this.buildRequestBody(options)

    const { responseHeaders, value: response } = await postJsonToApi({
      url: `${this.config.baseURL}/chat/completions`,
      headers: combineHeaders(this.config.headers(), options.headers),
      body,
      failedResponseHandler: arcErrorHandler,
      successfulResponseHandler: arcStreamHandler,
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    })

    return {
      stream: response.pipeThrough(createChunkTransformer()),
      request: { body },
      response: { headers: responseHeaders },
    }
  }

  private async buildRequestBody(options: LanguageModelV3CallOptions) {
    const providerOptions = await parseProviderOptions({
      provider: 'arc',
      providerOptions: options.providerOptions,
      schema: arcProviderOptionsSchema,
    })

    return {
      model: this.modelId,
      messages: convertToArcMessages(options.prompt),
      stream: true,
      ...(options.maxOutputTokens !== undefined && { max_tokens: options.maxOutputTokens }),
      ...(options.temperature !== undefined && { temperature: options.temperature }),
      ...(options.topP !== undefined && { top_p: options.topP }),
      ...(options.stopSequences !== undefined && { stop: options.stopSequences }),
      ...(providerOptions?.reasoningEffort && {
        reasoning_effort: providerOptions.reasoningEffort,
        thinking: { reasoning_effort: providerOptions.reasoningEffort },
      }),
    }
  }
}

// ============================================================================
// PROVIDER FACTORY
// ============================================================================

type ArcProviderSettings = {
  baseURL?: string
  apiKey?: string
  headers?: Record<string, string>
  fetch?: FetchFunction
}

export function createArc(settings: ArcProviderSettings = {}) {
  const baseURL = settings.baseURL ?? 'https://api.openai.com/v1'

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    ...(settings.apiKey && { Authorization: `Bearer ${settings.apiKey}` }),
    ...settings.headers,
  })

  return (modelId: string) =>
    new ArcLanguageModel(modelId, {
      provider: 'arc.chat',
      baseURL,
      headers: getHeaders,
      fetch: settings.fetch,
    })
}
