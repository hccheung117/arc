/**
 * AI Module
 *
 * Pure streaming operations with zero module dependencies.
 * Receives all data as parameters — orchestration is renderer's responsibility.
 */

import { defineModule } from '@main/kernel/module'
import * as biz from './business'

export default defineModule({
  capabilities: ['http', 'logger'],
  depends: [],
  provides: (_deps, caps, emit) => ({
    stream: (input) =>
      biz.stream(input, emit, caps.http, caps.logger),

    stop: (input) =>
      biz.stop(input.streamId),

    refine: (input) =>
      biz.refine(input, emit, caps.http, caps.logger),

    fetchModels: (input) =>
      biz.fetchModels(input, caps.http),
  }),
  emits: ['delta', 'reasoning', 'complete', 'error'],
  paths: [],
})
