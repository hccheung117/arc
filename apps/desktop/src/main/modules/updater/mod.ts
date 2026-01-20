/**
 * Updater Module
 *
 * Auto-update functionality for desktop application.
 * Windows-only (macOS requires code signing).
 */

import { defineModule } from '@main/kernel/module'
import type loggerAdapter from './logger'
import { createUpdater } from './business'

type Caps = {
  logger: ReturnType<typeof loggerAdapter.factory>
}

export default defineModule({
  capabilities: ['logger'] as const,
  depends: [] as const,
  provides: (_, caps: Caps) => createUpdater(caps.logger),
  emits: [] as const,
  paths: [],
})
