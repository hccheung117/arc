import fs from 'node:fs/promises'
import path from 'node:path'
import AdmZip from 'adm-zip'
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

export const exportProfile = (profileDir, destPath) => {
  const zip = new AdmZip()
  zip.addLocalFolder(profileDir, path.basename(profileDir))
  zip.writeZip(destPath)
}

export const seedBuiltinProfiles = async (builtinDir, profilesDir) => {
  const existing = await listProfiles()
  if (existing.length) return
  const entries = await fs.readdir(builtinDir, { withFileTypes: true }).catch(e => {
    if (e.code === 'ENOENT') return []
    throw e
  })
  for (const e of entries.filter(e => e.isDirectory())) {
    await fs.cp(path.join(builtinDir, e.name), path.join(profilesDir, e.name), { recursive: true })
  }
}

export const importProfile = async (arcFilePath, profilesDir) => {
  const zip = new AdmZip(arcFilePath)
  const entries = zip.getEntries()

  const topDirs = new Set(entries.map(e => e.entryName.split('/')[0]))
  if (topDirs.size !== 1) throw new Error('Invalid .arc file: must contain exactly one top-level folder')
  const name = [...topDirs][0]
  if (!entries.some(e => e.entryName === `${name}/arc.json`)) {
    throw new Error('Invalid .arc file: missing arc.json marker')
  }

  await fs.rm(path.join(profilesDir, name), { recursive: true, force: true })
  zip.extractAllTo(profilesDir, true)
  return name
}
