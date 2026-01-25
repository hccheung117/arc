import { z } from 'zod'
import { defineCapability, type FoundationCapabilities } from '@main/kernel/module'

type ScopedJsonFile = ReturnType<FoundationCapabilities['jsonFile']>

const FavoriteSchema = z.object({
  provider: z.string(),
  model: z.string(),
})

type Favorite = z.infer<typeof FavoriteSchema>

const SettingsSchema = z.object({
  activeProfile: z.string().nullable(),
  favorites: z.array(FavoriteSchema),
})

type Settings = z.infer<typeof SettingsSchema>

const DEFAULTS: Settings = { activeProfile: null, favorites: [] }

export default defineCapability((jsonFile: ScopedJsonFile) => {
  const file = jsonFile.create('app/settings.json', DEFAULTS, SettingsSchema)
  return {
    readActiveProfile: async () => (await file.read()).activeProfile,
    writeActiveProfile: (id: string | null) =>
      file.update((s) => ({ ...s, activeProfile: id })),
    readFavorites: async () => (await file.read()).favorites,
    writeFavorites: (favorites: Favorite[]) =>
      file.update((s) => ({ ...s, favorites })),
  }
})
