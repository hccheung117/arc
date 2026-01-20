/**
 * UI Module
 *
 * Native UI operations: context menus and window state management.
 */

import { defineModule } from '@main/kernel/module'
import type jsonFileAdapter from './json-file'
import type loggerAdapter from './logger'
import { createMenuOperations, createWindowStateOperations, MIN_SIZE } from './business'

export { MIN_SIZE }

type Caps = {
  jsonFile: ReturnType<typeof jsonFileAdapter.factory>
  logger: ReturnType<typeof loggerAdapter.factory>
}

export default defineModule({
  capabilities: ['jsonFile', 'logger'] as const,
  depends: [] as const,
  provides: (_, caps: Caps) => ({
    ...createMenuOperations(),
    ...createWindowStateOperations(caps.jsonFile, caps.logger),
  }),
  emits: [] as const,
  paths: ['app/cache/window-state.cache.json'],
})
