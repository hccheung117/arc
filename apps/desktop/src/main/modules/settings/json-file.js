import { z } from 'zod'
import { defineCapability } from '@main/kernel/module'

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

const DEFAULTS = { activeProfile: null }

export default defineCapability((jsonFile) => {
  const file = jsonFile.create('app/settings.json', DEFAULTS, SettingsSchema)
  return {
    readActiveProfile: async () => (await file.read()).activeProfile,
    writeActiveProfile: (id) =>
      file.update((s) => ({ ...s, activeProfile: id })),
    readFavorites: async () => (await file.read()).favorites,
    writeFavorites: (favorites) =>
      file.update((s) => ({ ...s, favorites })),
    readAssignments: async () => (await file.read()).assignments,
    writeAssignments: (assignments) =>
      file.update((s) => ({ ...s, assignments })),
    readShortcuts: async () => (await file.read()).shortcuts,
    writeShortcuts: (shortcuts) =>
      file.update((s) => ({ ...s, shortcuts })),
  }
})
