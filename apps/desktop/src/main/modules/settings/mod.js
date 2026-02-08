/**
 * Settings Module
 *
 * Owns all user state and preference resolution.
 * Layered: profile defaults ← app overrides.
 */

import { defineModule } from '@main/kernel/module'
import * as biz from './business'

export default defineModule({
  capabilities: ['jsonFile'],
  depends: ['profiles'],
  provides: (deps, caps, emit) => {
    const ctx = { jsonFile: caps.jsonFile, profiles: deps.profiles }

    return {
      activate: async (input) => {
        await biz.activate(ctx, input.profileId)
        emit('activated', input.profileId)
      },

      getActiveProfileId: () => biz.getActiveProfileId(ctx),

      getFavorites: () => biz.getFavorites(ctx),
      setFavorites: (input) =>
        biz.setFavorites(ctx, input.favorites),

      getAssignments: () => biz.getAssignments(ctx),
      setAssignments: (input) =>
        biz.setAssignments(ctx, input.assignments),

      getShortcuts: () => biz.getShortcuts(ctx),
      setShortcuts: (input) =>
        biz.setShortcuts(ctx, input.shortcuts),
    }
  },
  emits: ['activated'],
  paths: ['app/settings.json'],
})
