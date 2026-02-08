/**
 * Personas Module
 *
 * Two-layer persona system: user personas shadow profile personas.
 * Depends on settings for active profile ID resolution.
 */

import { defineModule } from '@main/kernel/module'
import * as biz from './business'

export default defineModule({
  capabilities: ['markdownFile', 'binaryFile', 'glob', 'logger'],
  depends: ['settings'],
  provides: (deps, caps, emit) => {
    const settings = deps.settings

    return {
      list: async () => {
        const activeProfile = await settings.getActiveProfileId()
        return biz.listPersonas(caps, activeProfile)
      },

      get: async (input) => {
        const activeProfile = await settings.getActiveProfileId()
        return biz.getPersona(caps, activeProfile, input.name)
      },

      create: async (input) => {
        const persona = await biz.createPersona(caps, input.name, input.systemPrompt)
        emit('created', persona)
        return persona
      },

      update: async (input) => {
        const persona = await biz.updatePersona(caps, input.name, input.systemPrompt)
        emit('updated', persona)
        return persona
      },

      delete: async (input) => {
        await biz.deletePersona(caps, input.name)
        emit('deleted', input.name)
      },

      resolve: async (input) => {
        const activeProfile = await settings.getActiveProfileId()
        return biz.resolvePrompt(caps, activeProfile, input.prompt)
      },
    }
  },
  emits: ['created', 'updated', 'deleted'],
  paths: ['app/personas/', 'profiles/'],
})
