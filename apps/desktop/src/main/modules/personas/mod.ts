import { defineModule } from '@main/kernel/module'
import {
  listPersonas,
  getPersona,
  createPersona,
  updatePersona,
  deletePersona,
} from '@main/lib/personas/operations'

export default defineModule({
  capabilities: ['jsonFile', 'logger'] as const,
  depends: ['profiles'] as const,
  provides: () => ({
    list: listPersonas,
    get: getPersona,
    create: createPersona,
    update: updatePersona,
    delete: deletePersona,
  }),
  emits: ['created', 'updated', 'deleted'] as const,
  paths: ['app/personas/'],
})
