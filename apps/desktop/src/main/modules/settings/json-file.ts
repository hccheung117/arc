import { z } from 'zod'
import { defineCapability, type FoundationCapabilities } from '@main/kernel/module'

type ScopedJsonFile = ReturnType<FoundationCapabilities['jsonFile']>

const FavoriteSchema = z.object({
  provider: z.string(),
  model: z.string(),
})

const AssignmentSchema = z.object({
  provider: z.string(),
  model: z.string(),
})

const ShortcutsSchema = z.object({
  send: z.enum(['enter', 'shift+enter']),
})

// Preference fields are optional — absence means "use profile default"
const SettingsSchema = z.object({
  activeProfile: z.string().nullable(),
  favorites: z.array(FavoriteSchema).optional(),
  assignments: z.record(z.string(), AssignmentSchema).optional(),
  shortcuts: ShortcutsSchema.optional(),
})

type Settings = z.infer<typeof SettingsSchema>

export type Favorite = z.infer<typeof FavoriteSchema>
export type Assignment = z.infer<typeof AssignmentSchema>
export type Shortcuts = z.infer<typeof ShortcutsSchema>

const DEFAULTS: Settings = { activeProfile: null }

export default defineCapability((jsonFile: ScopedJsonFile) => {
  const file = jsonFile.create('app/settings.json', DEFAULTS, SettingsSchema)
  return {
    readActiveProfile: async () => (await file.read()).activeProfile,
    writeActiveProfile: (id: string | null) =>
      file.update((s) => ({ ...s, activeProfile: id })),
    readFavorites: async () => (await file.read()).favorites,
    writeFavorites: (favorites: Favorite[] | undefined) =>
      file.update((s) => ({ ...s, favorites })),
    readAssignments: async () => (await file.read()).assignments,
    writeAssignments: (assignments: Record<string, Assignment> | undefined) =>
      file.update((s) => ({ ...s, assignments })),
    readShortcuts: async () => (await file.read()).shortcuts,
    writeShortcuts: (shortcuts: Shortcuts | undefined) =>
      file.update((s) => ({ ...s, shortcuts })),
  }
})
