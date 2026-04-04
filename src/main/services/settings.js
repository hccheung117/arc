import { resolve, readJson, writeJson } from '../arcfs.js'
import { getActiveProfile, appPath } from './profile.js'
import { getProvider } from './provider.js'

const mergeAssignments = (profile, app) => {
  const merged = { ...profile, ...app }
  return Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== null))
}

const matchFav = (a, b) => a.provider === b.provider && a.model === b.model

const mergeFavorites = (profile, app) => {
  const cancels = app.filter((e) => e.cancel)
  const adds = app.filter((e) => !e.cancel)
  const kept = profile.filter((e) => !cancels.some((c) => matchFav(c, e)))
  return [...kept, ...adds.filter((e) => !kept.some((k) => matchFav(k, e)))]
}

export const getSettings = async () => {
  const appSettings = await readJson(appPath('settings.json')) ?? {}
  const profileName = await getActiveProfile()
  const profileSettings = profileName
    ? await readJson(resolve('profiles', profileName, 'settings.json')) ?? {}
    : {}

  return {
    assignments: mergeAssignments(
      profileSettings.assignments ?? {},
      appSettings.assignments ?? {},
    ),
    favorites: mergeFavorites(
      profileSettings.favorites ?? [],
      appSettings.favorites ?? [],
    ),
  }
}

export const setFavorite = async (provider, model) => {
  const settingsPath = appPath('settings.json')
  const appSettings = await readJson(settingsPath) ?? {}
  const appFavs = appSettings.favorites ?? []

  const profileName = await getActiveProfile()
  const profileSettings = profileName
    ? await readJson(resolve('profiles', profileName, 'settings.json')) ?? {}
    : {}
  const profileFavs = profileSettings.favorites ?? []

  const entry = { provider, model }
  const merged = mergeFavorites(profileFavs, appFavs)
  const isFavorited = merged.some((e) => matchFav(e, entry))
  const inProfile = profileFavs.some((e) => matchFav(e, entry))
  const appIdx = appFavs.findIndex((e) => matchFav(e, entry))

  const without = appIdx !== -1 ? appFavs.filter((_, i) => i !== appIdx) : appFavs
  let next
  if (isFavorited) {
    next = inProfile ? [...without, { provider, model, cancel: true }] : without
  } else {
    next = inProfile ? without : [...without, { provider, model }]
  }

  await writeJson(settingsPath, { ...appSettings, favorites: next })
}

export const getTypography = async () => {
  const appSettings = await readJson(appPath('settings.json')) ?? {}
  return appSettings.typography ?? { lineHeight: null }
}

export const setTypography = async (patch) => {
  const settingsPath = appPath('settings.json')
  const appSettings = await readJson(settingsPath) ?? {}
  const current = appSettings.typography ?? { lineHeight: null }
  await writeJson(settingsPath, { ...appSettings, typography: { ...current, ...patch } })
}

export const getAssignment = async (key) => {
  const { assignments } = await getSettings()
  const entry = assignments[key]
  if (!entry) return null

  const provider = await getProvider(entry.provider)
  if (!provider) return null

  return { provider, modelId: entry.model }
}
