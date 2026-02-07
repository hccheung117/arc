/**
 * Personas Module
 *
 * Two-layer persona system: user personas shadow profile personas.
 * Depends on settings for active profile ID resolution.
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

type SettingsDep = {
  getActiveProfileId: () => Promise<string | null>
}

export default defineModule({
  capabilities: ['markdownFile', 'binaryFile', 'glob', 'logger'] as const,
  depends: ['settings'] as const,
  provides: (deps, caps: Caps, emit) => {
    const settings = deps.settings as SettingsDep

    return {
      list: async () => {
        const activeProfile = await settings.getActiveProfileId()
        return biz.listPersonas(caps, activeProfile)
      },

      get: async (input: { name: string }) => {
        const activeProfile = await settings.getActiveProfileId()
        return biz.getPersona(caps, activeProfile, input.name)
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

      resolve: async (input: { prompt: biz.Prompt }) => {
        const activeProfile = await settings.getActiveProfileId()
        return biz.resolvePrompt(caps, activeProfile, input.prompt)
      },
    }
  },
  emits: ['created', 'updated', 'deleted'] as const,
  paths: ['app/personas/', 'profiles/'],
})
