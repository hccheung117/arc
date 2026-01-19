import { defineModule } from '@main/kernel/module'

export default defineModule({
  capabilities: ['logger'] as const,
  depends: ['profiles', 'messages', 'personas'] as const,
  provides: () => ({}),
  emits: ['delta', 'reasoning', 'complete', 'error'] as const,
  paths: [],
})
