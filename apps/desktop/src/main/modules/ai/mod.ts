/**
 * AI Module
 *
 * Pure streaming operations with zero module dependencies.
 * Receives all data as parameters — orchestration is renderer's responsibility.
 */

import { defineModule } from '@main/kernel/module'
import type loggerAdapter from './logger'
import * as biz from './business'

type Caps = {
  logger: ReturnType<typeof loggerAdapter.factory>
}

export default defineModule({
  capabilities: ['logger'] as const,
  depends: [] as const,
  provides: (_deps, caps: Caps, emit) => ({
    stream: (input: biz.StreamInput) =>
      biz.stream(input, emit, caps.logger),

    stop: (input: { streamId: string }) =>
      biz.stop(input.streamId),

    refine: (input: biz.RefineInput) =>
      biz.refine(input, emit, caps.logger),

    fetchModels: (input: biz.FetchModelsInput) =>
      biz.fetchModels(input),
  }),
  emits: ['delta', 'reasoning', 'complete', 'error'] as const,
  paths: [],
})
