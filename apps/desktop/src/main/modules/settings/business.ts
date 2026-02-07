/**
 * Settings Business Logic
 *
 * Layered preference resolution: profile defaults ← app overrides.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Favorite = { provider: string; model: string }
type Assignment = { provider: string; model: string }
type Shortcuts = { send: 'enter' | 'shift+enter' }

const DEFAULT_SHORTCUTS: Shortcuts = { send: 'enter' }

type ProfileDefaults = {
  favorites?: Favorite[]
  assignments?: Record<string, Assignment>
  shortcuts?: Shortcuts
}

type JsonFileCap = {
  readActiveProfile: () => Promise<string | null>
  writeActiveProfile: (id: string | null) => Promise<void>
  readFavorites: () => Promise<Favorite[] | undefined>
  writeFavorites: (favorites: Favorite[] | undefined) => Promise<void>
  readAssignments: () => Promise<Record<string, Assignment> | undefined>
  writeAssignments: (assignments: Record<string, Assignment> | undefined) => Promise<void>
  readShortcuts: () => Promise<Shortcuts | undefined>
  writeShortcuts: (shortcuts: Shortcuts | undefined) => Promise<void>
}

type ProfilesDep = {
  readSettings: (input: { profileId: string }) => Promise<ProfileDefaults | null>
  syncModels: (input: { profileId: string }) => Promise<unknown>
  clearModelsCache: () => Promise<void>
  list: () => Promise<Array<{ id: string }>>
}

export type Ctx = {
  jsonFile: JsonFileCap
  profiles: ProfilesDep
}

// ─────────────────────────────────────────────────────────────────────────────
// Profile Defaults
// ─────────────────────────────────────────────────────────────────────────────

async function getProfileDefaults(ctx: Ctx): Promise<ProfileDefaults | null> {
  const activeId = await ctx.jsonFile.readActiveProfile()
  if (!activeId) return null
  return ctx.profiles.readSettings({ profileId: activeId })
}

// ─────────────────────────────────────────────────────────────────────────────
// Activation
// ─────────────────────────────────────────────────────────────────────────────

export async function activate(ctx: Ctx, profileId: string | null): Promise<void> {
  if (profileId) {
    const profiles = await ctx.profiles.list()
    if (!profiles.some(p => p.id === profileId)) {
      throw new Error(`Profile ${profileId} not found`)
    }
  }
  await ctx.jsonFile.writeActiveProfile(profileId)
  if (profileId) {
    await ctx.profiles.syncModels({ profileId })
  } else {
    await ctx.profiles.clearModelsCache()
  }
}

export async function getActiveProfileId(ctx: Ctx): Promise<string | null> {
  return ctx.jsonFile.readActiveProfile()
}

// ─────────────────────────────────────────────────────────────────────────────
// Layered Reads
// ─────────────────────────────────────────────────────────────────────────────

export async function getFavorites(ctx: Ctx): Promise<Favorite[]> {
  const appFavorites = await ctx.jsonFile.readFavorites()
  if (appFavorites !== undefined) return appFavorites
  const defaults = await getProfileDefaults(ctx)
  return defaults?.favorites ?? []
}

export async function getAssignments(ctx: Ctx): Promise<Record<string, Assignment>> {
  const defaults = await getProfileDefaults(ctx)
  const profileAssignments = defaults?.assignments ?? {}
  const appAssignments = await ctx.jsonFile.readAssignments()
  // Per-key merge: app overrides individual assignment keys
  return { ...profileAssignments, ...(appAssignments ?? {}) }
}

export async function getShortcuts(ctx: Ctx): Promise<Shortcuts> {
  const appShortcuts = await ctx.jsonFile.readShortcuts()
  if (appShortcuts !== undefined) return appShortcuts
  const defaults = await getProfileDefaults(ctx)
  return defaults?.shortcuts ?? DEFAULT_SHORTCUTS
}

// ─────────────────────────────────────────────────────────────────────────────
// Writes (app layer only)
// ─────────────────────────────────────────────────────────────────────────────

export async function setFavorites(ctx: Ctx, favorites: Favorite[]): Promise<void> {
  await ctx.jsonFile.writeFavorites(favorites)
}

export async function setAssignments(ctx: Ctx, assignments: Record<string, Assignment>): Promise<void> {
  await ctx.jsonFile.writeAssignments(assignments)
}

export async function setShortcuts(ctx: Ctx, shortcuts: Shortcuts): Promise<void> {
  await ctx.jsonFile.writeShortcuts(shortcuts)
}
