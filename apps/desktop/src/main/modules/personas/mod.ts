/**
 * Personas Module
 *
 * Two-layer persona system: user personas shadow profile personas.
 * Depends on profiles for active profile ID resolution.
 */

import { defineModule } from '@main/kernel/module'
import type markdownFileAdapter from './markdown-file'
import type binaryFileAdapter from './binary-file'
import type globAdapter from './glob'
import type loggerAdapter from './logger'
import * as biz from './business'

type Caps = {
  markdownFile: ReturnType<typeof markdownFileAdapter.factory>
  binaryFile: ReturnType<typeof binaryFileAdapter.factory>
  glob: ReturnType<typeof globAdapter.factory>
  logger: ReturnType<typeof loggerAdapter.factory>
}

type ProfilesDep = {
  getActiveId: () => Promise<string | null>
}

export default defineModule({
  capabilities: ['markdownFile', 'binaryFile', 'glob', 'logger'] as const,
  depends: ['profiles'] as const,
  provides: (deps, caps: Caps, emit) => {
    const profiles = deps.profiles as ProfilesDep

    return {
      list: async () => {
        const activeProfileId = await profiles.getActiveId()
        return biz.listPersonas(caps, activeProfileId)
      },

      get: async (input: { name: string }) => {
        const activeProfileId = await profiles.getActiveId()
        return biz.getPersona(caps, activeProfileId, input.name)
      },

      create: async (input: { name: string; systemPrompt: string }) => {
        const persona = await biz.createPersona(caps, input.name, input.systemPrompt)
        emit('created', persona)
        return persona
      },

      update: async (input: { name: string; systemPrompt: string }) => {
        const persona = await biz.updatePersona(caps, input.name, input.systemPrompt)
        emit('updated', persona)
        return persona
      },

      delete: async (input: { name: string }) => {
        await biz.deletePersona(caps, input.name)
        emit('deleted', input.name)
      },

      resolve: async (input: { promptSource: biz.PromptSource }) => {
        const activeProfileId = await profiles.getActiveId()
        return biz.resolvePromptSource(caps, activeProfileId, input.promptSource)
      },
    }
  },
  emits: ['created', 'updated', 'deleted'] as const,
  paths: ['app/personas/', 'profiles/'],
})
