/**
 * Settings Business Logic
 *
 * Layered preference resolution: profile defaults ← app overrides.
 */

const DEFAULT_SHORTCUTS = { send: 'enter' }

// ─────────────────────────────────────────────────────────────────────────────
// Profile Defaults
// ─────────────────────────────────────────────────────────────────────────────

async function getProfileDefaults(ctx) {
  const activeId = await ctx.jsonFile.readActiveProfile()
  if (!activeId) return null
  return ctx.profiles.readSettings({ profileId: activeId })
}

// ─────────────────────────────────────────────────────────────────────────────
// Activation
// ─────────────────────────────────────────────────────────────────────────────

export async function activate(ctx, profileId) {
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

export async function getActiveProfileId(ctx) {
  return ctx.jsonFile.readActiveProfile()
}

// ─────────────────────────────────────────────────────────────────────────────
// Layered Reads
// ─────────────────────────────────────────────────────────────────────────────

export async function getFavorites(ctx) {
  const appFavorites = await ctx.jsonFile.readFavorites()
  if (appFavorites !== undefined) return appFavorites
  const defaults = await getProfileDefaults(ctx)
  return defaults?.favorites ?? []
}

export async function getAssignments(ctx) {
  const defaults = await getProfileDefaults(ctx)
  const profileAssignments = defaults?.assignments ?? {}
  const appAssignments = await ctx.jsonFile.readAssignments()
  // Per-key merge: app overrides individual assignment keys
  return { ...profileAssignments, ...(appAssignments ?? {}) }
}

export async function getShortcuts(ctx) {
  const appShortcuts = await ctx.jsonFile.readShortcuts()
  if (appShortcuts !== undefined) return appShortcuts
  const defaults = await getProfileDefaults(ctx)
  return defaults?.shortcuts ?? DEFAULT_SHORTCUTS
}

// ─────────────────────────────────────────────────────────────────────────────
// Writes (app layer only)
// ─────────────────────────────────────────────────────────────────────────────

export async function setFavorites(ctx, favorites) {
  await ctx.jsonFile.writeFavorites(favorites)
}

export async function setAssignments(ctx, assignments) {
  await ctx.jsonFile.writeAssignments(assignments)
}

export async function setShortcuts(ctx, shortcuts) {
  await ctx.jsonFile.writeShortcuts(shortcuts)
}
