import { defineModule } from '@main/kernel/module'
import { createOperations } from './business'

export default defineModule({
  capabilities: ['jsonFile', 'logger'],
  depends: [],
  provides: (_, caps) => createOperations(caps.jsonFile, caps.logger),
  emits: [],
  paths: ['app/cache/window-state.cache.json'],
})
