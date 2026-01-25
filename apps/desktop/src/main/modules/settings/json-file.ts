import { z } from 'zod'
import { defineCapability, type FoundationCapabilities } from '@main/kernel/module'

type ScopedJsonFile = ReturnType<FoundationCapabilities['jsonFile']>

const FavoriteSchema = z.object({
  provider: z.string(),
  model: z.string(),
})

type Favorite = z.infer<typeof FavoriteSchema>

const ShortcutsSchema = z.object({
  send: z.enum(['enter', 'shift+enter']),
})

type Shortcuts = z.infer<typeof ShortcutsSchema>

const SettingsSchema = z.object({
  activeProfile: z.string().nullable(),
  favorites: z.array(FavoriteSchema),
  shortcuts: ShortcutsSchema,
})

type Settings = z.infer<typeof SettingsSchema>

const DEFAULTS: Settings = { activeProfile: null, favorites: [], shortcuts: { send: 'enter' } }

export default defineCapability((jsonFile: ScopedJsonFile) => {
  const file = jsonFile.create('app/settings.json', DEFAULTS, SettingsSchema)
  return {
    readActiveProfile: async () => (await file.read()).activeProfile,
    writeActiveProfile: (id: string | null) =>
      file.update((s) => ({ ...s, activeProfile: id })),
    readFavorites: async () => (await file.read()).favorites,
    writeFavorites: (favorites: Favorite[]) =>
      file.update((s) => ({ ...s, favorites })),
    readShortcuts: async () => (await file.read()).shortcuts,
    writeShortcuts: (shortcuts: Shortcuts) =>
      file.update((s) => ({ ...s, shortcuts })),
  }
})
