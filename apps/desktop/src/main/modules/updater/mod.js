/**
 * Updater Module
 *
 * Auto-update functionality for desktop application.
 * Windows-only (macOS requires code signing).
 */

import { defineModule } from '@main/kernel/module'
import { createUpdater } from './business'

export default defineModule({
  capabilities: ['logger'],
  depends: [],
  provides: (_, caps) => createUpdater(caps.logger),
  emits: [],
  paths: [],
})
