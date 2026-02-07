/**
 * Settings Module
 *
 * Owns all user state and preference resolution.
 * Layered: profile defaults ← app overrides.
 */

import { defineModule } from '@main/kernel/module'
import type jsonFileAdapter from './json-file'
import * as biz from './business'

type Caps = {
  jsonFile: ReturnType<typeof jsonFileAdapter.factory>
}

type Deps = {
  profiles: biz.Ctx['profiles']
}

export default defineModule({
  capabilities: ['jsonFile'] as const,
  depends: ['profiles'] as const,
  provides: (deps, caps: Caps, emit) => {
    const ctx: biz.Ctx = { jsonFile: caps.jsonFile, profiles: deps.profiles as Deps['profiles'] }

    return {
      activate: async (input: { profileId: string | null }) => {
        await biz.activate(ctx, input.profileId)
        emit('activated', input.profileId)
      },

      getActiveProfileId: () => biz.getActiveProfileId(ctx),

      getFavorites: () => biz.getFavorites(ctx),
      setFavorites: (input: { favorites: Array<{ provider: string; model: string }> }) =>
        biz.setFavorites(ctx, input.favorites),

      getAssignments: () => biz.getAssignments(ctx),
      setAssignments: (input: { assignments: Record<string, { provider: string; model: string }> }) =>
        biz.setAssignments(ctx, input.assignments),

      getShortcuts: () => biz.getShortcuts(ctx),
      setShortcuts: (input: { shortcuts: { send: 'enter' | 'shift+enter' } }) =>
        biz.setShortcuts(ctx, input.shortcuts),
    }
  },
  emits: ['activated'] as const,
  paths: ['app/settings.json'],
})
