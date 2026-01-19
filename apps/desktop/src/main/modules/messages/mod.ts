import { defineModule } from '@main/kernel/module'
import { readMessages, appendMessage } from '@main/lib/messages/operations'

export default defineModule({
  capabilities: ['jsonLog', 'logger'] as const,
  depends: [] as const,
  provides: () => ({ read: readMessages, append: appendMessage }),
  emits: ['created', 'updated'] as const,
  paths: ['app/messages/'],
})
