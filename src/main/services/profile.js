import fs from 'node:fs/promises'
import { resolve, readJson, writeJson } from '../arcfs.js'

const configPath = () => resolve('profiles', 'config.json')

export const listProfiles = async () => {
  const entries = await fs.readdir(resolve('profiles'), { withFileTypes: true }).catch(e => {
    if (e.code === 'ENOENT') return []
    throw e
  })
  return entries.filter(e => e.isDirectory() && e.name !== '@app').map(e => e.name)
}

export const activateProfile = async (name) => {
  const profiles = await listProfiles()
  if (!profiles.includes(name)) throw new Error(`Profile not found: ${name}`)
  await writeJson(configPath(), { activeProfile: name })
}

export const getActiveProfile = async () => {
  const config = await readJson(configPath())
  return config?.activeProfile ?? null
}

export const resolveDir = async (subpath, listFn) => {
  const appEntries = await listFn(resolve('profiles', '@app', subpath))
  const appTagged = appEntries.map(e => ({ ...e, source: '@app' }))

  const config = await readJson(configPath())
  const profileName = config?.activeProfile
  if (!profileName) return appTagged

  const profileDir = resolve('profiles', profileName, subpath)
  const profileEntries = await listFn(profileDir)
  const profileTagged = profileEntries.map(e => ({ ...e, source: profileName }))

  const appNames = new Set(appTagged.map(e => e.name))
  return [...profileTagged.filter(e => !appNames.has(e.name)), ...appTagged]
}

export const appPath = (subpath) => resolve('profiles', '@app', subpath)
