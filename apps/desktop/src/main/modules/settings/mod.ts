import { defineModule } from '@main/kernel/module'
import { getSetting, setSetting } from '@main/lib/profile/operations'

export default defineModule({
  capabilities: ['jsonFile'] as const,
  depends: [] as const,
  provides: () => ({ get: getSetting, set: setSetting }),
  emits: [] as const,
  paths: ['app/settings.json'],
})
