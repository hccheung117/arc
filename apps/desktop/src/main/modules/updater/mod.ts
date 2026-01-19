import { defineModule } from '@main/kernel/module'
import { initAutoUpdate } from '@main/lib/updater/operations'

export default defineModule({
  capabilities: ['logger'] as const,
  depends: [] as const,
  provides: () => ({ init: initAutoUpdate }),
  emits: [] as const,
  paths: [],
})
