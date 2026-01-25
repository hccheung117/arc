import { defineModule } from '@main/kernel/module'
import type jsonFileAdapter from './json-file'
import type loggerAdapter from './logger'
import { createOperations } from './business'

type Caps = {
  jsonFile: ReturnType<typeof jsonFileAdapter.factory>
  logger: ReturnType<typeof loggerAdapter.factory>
}

export default defineModule({
  capabilities: ['jsonFile', 'logger'] as const,
  depends: [] as const,
  provides: (_, caps: Caps) => createOperations(caps.jsonFile, caps.logger),
  emits: [] as const,
  paths: ['app/cache/window-state.cache.json'],
})
