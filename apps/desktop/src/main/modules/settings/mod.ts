import { defineModule } from '@main/kernel/module'
import type jsonFileAdapter from './json-file'

type Caps = {
  jsonFile: ReturnType<typeof jsonFileAdapter.factory>
}

export default defineModule({
  capabilities: ['jsonFile'] as const,
  depends: [] as const,
  provides: (_deps, caps: Caps) => ({
    getActiveProfile: () => caps.jsonFile.readActiveProfile(),
    setActiveProfile: (input: { id: string | null }) =>
      caps.jsonFile.writeActiveProfile(input.id),
    getFavorites: () => caps.jsonFile.readFavorites(),
    setFavorites: (input: { favorites: Array<{ provider: string; model: string }> }) =>
      caps.jsonFile.writeFavorites(input.favorites),
  }),
  emits: [] as const,
  paths: ['app/settings.json'],
})
