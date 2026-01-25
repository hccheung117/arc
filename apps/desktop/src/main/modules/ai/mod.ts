/**
 * AI Module
 *
 * Pure streaming operations with zero module dependencies.
 * Receives all data as parameters — orchestration is renderer's responsibility.
 */

import { defineModule } from '@main/kernel/module'
import type httpAdapter from './http'
import type loggerAdapter from './logger'
import * as biz from './business'

type Caps = {
  http: ReturnType<typeof httpAdapter.factory>
  logger: ReturnType<typeof loggerAdapter.factory>
}

export default defineModule({
  capabilities: ['http', 'logger'] as const,
  depends: [] as const,
  provides: (_deps, caps: Caps, emit) => ({
    stream: (input: biz.StreamInput) =>
      biz.stream(input, emit, caps.http, caps.logger),

    stop: (input: { streamId: string }) =>
      biz.stop(input.streamId),

    refine: (input: biz.RefineInput) =>
      biz.refine(input, emit, caps.http, caps.logger),

    fetchModels: (input: biz.FetchModelsInput) =>
      biz.fetchModels(input, caps.http),
  }),
  emits: ['delta', 'reasoning', 'complete', 'error'] as const,
  paths: [],
})
