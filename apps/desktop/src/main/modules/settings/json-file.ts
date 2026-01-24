import { z } from 'zod'
import { defineCapability, type FoundationCapabilities } from '@main/kernel/module'

type ScopedJsonFile = ReturnType<FoundationCapabilities['jsonFile']>

const FavoriteSchema = z.object({
  providerId: z.string(),
  modelId: z.string(),
})

type Favorite = z.infer<typeof FavoriteSchema>

const SettingsSchema = z.object({
  favorites: z.array(FavoriteSchema),
})

const DEFAULTS = { favorites: [] as Favorite[] }

export default defineCapability((jsonFile: ScopedJsonFile) => {
  const file = jsonFile.create('app/settings.json', DEFAULTS, SettingsSchema)
  return {
    readFavorites: async () => (await file.read()).favorites,
    writeFavorites: (favorites: Favorite[]) =>
      file.update((s) => ({ ...s, favorites })),
  }
})
