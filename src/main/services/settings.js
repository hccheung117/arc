import { resolve, readJson } from '../arcfs.js'
import { getActiveProfile, appPath } from './profile.js'
import { getProvider } from './provider.js'

const mergeAssignments = (profile, app) => {
  const merged = { ...profile, ...app }
  return Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== null))
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
  }
}

export const getAssignment = async (key) => {
  const { assignments } = await getSettings()
  const entry = assignments[key]
  if (!entry) return null

  const provider = await getProvider(entry.provider)
  if (!provider) return null

  return { provider, modelId: entry.model }
}
