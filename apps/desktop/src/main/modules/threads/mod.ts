import { defineModule } from '@main/kernel/module'
import { execute, listThreads } from '@main/lib/messages/commands'

export default defineModule({
  capabilities: ['jsonFile', 'jsonLog', 'logger'] as const,
  depends: ['messages'] as const,
  provides: () => ({ list: listThreads, execute }),
  emits: ['created', 'updated', 'deleted', 'moved', 'reordered'] as const,
  paths: ['app/messages/index.json'],
})
