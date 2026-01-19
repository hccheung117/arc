import { defineModule } from '@main/kernel/module'
import { showThreadContextMenu, showMessageContextMenu } from '@main/lib/ui'

export default defineModule({
  capabilities: [] as const,
  depends: [] as const,
  provides: () => ({ showThreadContextMenu, showMessageContextMenu }),
  emits: [] as const,
  paths: [],
})
