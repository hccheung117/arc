/**
 * Profiles Business Logic
 *
 * Domain logic for profile lifecycle, provider configuration, and model discovery.
 * Receives capabilities as parameters; zero knowledge of persistence format.
 */

import { createHash } from 'crypto'
import type {
  ArcFile,
  ArcModelFilter,
  CachedModel,
  StoredFavorite,
  StoredSettings,
  ArcFileValidationResult,
} from './json-file'
import type { Logger } from './logger'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type JsonFileCap = {
  settings: {
    read: () => Promise<StoredSettings>
    update: (updater: (data: StoredSettings) => StoredSettings) => void
  }
  arcFile: {
    validate: (content: string) => ArcFileValidationResult
  }
  modelsCache: {
    read: () => Promise<CachedModel[]>
    write: (models: CachedModel[]) => Promise<void>
  }
}

export type ArchiveCap = {
  extractExternal: (externalAbsPath: string, targetDir: string) => Promise<void>
}

export type GlobCap = {
  listProfileDirs: () => Promise<string[]>
  matches: (value: string, pattern: string) => boolean
}

export type BinaryFileCap = {
  deleteDir: (relativePath: string) => Promise<void>
  rename: (srcPath: string, dstPath: string) => Promise<void>
  readFile: (relativePath: string) => Promise<Buffer | null>
}

export type AiDep = {
  fetchModels: (input: { baseUrl?: string; apiKey?: string }) => Promise<Array<{ id: string }>>
}

export interface ProfileInfo {
  id: string
  name: string
  providerCount: number
}

export interface ProfileInstallResult {
  id: string
  name: string
  providerCount: number
}

export interface ProviderConfig {
  type: string
  apiKey: string | null
  baseUrl: string | null
}

export interface Model {
  id: string
  name: string
  provider: { id: string; name: string; type: 'openai' }
}

interface ProviderInput {
  id: string
  baseUrl?: string | null
  apiKey?: string | null
  filter?: ArcModelFilter | null
  aliases?: Record<string, string> | null
  providerName: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure Functions
// ─────────────────────────────────────────────────────────────────────────────

export function generateProviderId(provider: {
  type: string
  apiKey?: string | null
  baseUrl?: string | null
}) {
  const input = `${provider.type}|${provider.apiKey ?? ''}|${provider.baseUrl ?? ''}`
  return createHash('sha256').update(input).digest('hex').slice(0, 8)
}

function passesFilter(modelId: string, filter: ArcModelFilter | null, matches: GlobCap['matches']): boolean {
  if (!filter || filter.rules.length === 0) return true
  const hit = filter.rules.some(rule => matches(modelId, rule))
  return filter.mode === 'allow' ? hit : !hit
}

function transformModels(
  raw: Array<{ id: string }>,
  provider: ProviderInput,
  timestamp: string,
  matches: GlobCap['matches'],
): CachedModel[] {
  return raw
    .filter(m => passesFilter(m.id, provider.filter ?? null, matches))
    .map(m => ({
      id: m.id,
      name: provider.aliases?.[m.id] ?? m.id,
      providerId: provider.id,
      providerName: provider.providerName,
      providerType: 'openai' as const,
      fetchedAt: timestamp,
    }))
}

function toPublicModel(cached: CachedModel): Model {
  return {
    id: cached.id,
    name: cached.name,
    provider: { id: cached.providerId, name: cached.providerName, type: cached.providerType },
  }
}

function extractProviders(profile: ArcFile): ProviderInput[] {
  return profile.providers.map(p => ({
    id: generateProviderId(p),
    baseUrl: p.baseUrl,
    apiKey: p.apiKey,
    filter: p.modelFilter,
    aliases: p.modelAliases,
    providerName: profile.name,
  }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Profile Lifecycle
// ─────────────────────────────────────────────────────────────────────────────

export async function installProfile(
  jsonFile: JsonFileCap,
  archive: ArchiveCap,
  binaryFile: BinaryFileCap,
  archivePath: string,
): Promise<ProfileInstallResult> {
  const tempDir = `profiles/.installing-${Date.now()}`

  try {
    await archive.extractExternal(archivePath, tempDir)

    const arcJsonBuf = await binaryFile.readFile(`${tempDir}/arc.json`)
    if (!arcJsonBuf) throw new Error('Invalid archive: missing arc.json')

    const validation = jsonFile.arcFile.validate(arcJsonBuf.toString('utf-8'))
    if (!validation.valid) throw new Error(validation.error)

    const arcFile = validation.data
    const targetDir = `profiles/${arcFile.id}`

    await binaryFile.deleteDir(targetDir)
    await binaryFile.rename(tempDir, targetDir)

    return {
      id: arcFile.id,
      name: arcFile.name,
      providerCount: arcFile.providers.length,
    }
  } catch (error) {
    await binaryFile.deleteDir(tempDir).catch(() => {})
    throw error
  }
}

export async function uninstallProfile(
  jsonFile: JsonFileCap,
  binaryFile: BinaryFileCap,
  profileId: string,
): Promise<void> {
  await binaryFile.deleteDir(`profiles/${profileId}`)
  await jsonFile.settings.update(settings => ({
    ...settings,
    activeProfileId: settings.activeProfileId === profileId ? null : settings.activeProfileId,
  }))
}

export async function listProfiles(
  jsonFile: JsonFileCap,
  glob: GlobCap,
  binaryFile: BinaryFileCap,
): Promise<ProfileInfo[]> {
  const entries = await glob.listProfileDirs()
  const profiles: ProfileInfo[] = []

  for (const entry of entries) {
    if (entry.startsWith('.')) continue

    const buf = await binaryFile.readFile(`profiles/${entry}/arc.json`)
    if (!buf) continue

    const validation = jsonFile.arcFile.validate(buf.toString('utf-8'))
    if (validation.valid) {
      profiles.push({
        id: validation.data.id,
        name: validation.data.name,
        providerCount: validation.data.providers.length,
      })
    }
  }

  return profiles
}

export async function activateProfile(
  jsonFile: JsonFileCap,
  glob: GlobCap,
  binaryFile: BinaryFileCap,
  profileId: string | null,
): Promise<void> {
  if (profileId) {
    const profiles = await listProfiles(jsonFile, glob, binaryFile)
    if (!profiles.some(p => p.id === profileId)) {
      throw new Error(`Profile ${profileId} not found`)
    }
  }
  await jsonFile.settings.update(settings => ({ ...settings, activeProfileId: profileId }))
}

export async function getActiveProfile(
  jsonFile: JsonFileCap,
  binaryFile: BinaryFileCap,
): Promise<ArcFile | null> {
  const settings = await jsonFile.settings.read()
  if (!settings.activeProfileId) return null

  const buf = await binaryFile.readFile(`profiles/${settings.activeProfileId}/arc.json`)
  if (!buf) return null

  const validation = jsonFile.arcFile.validate(buf.toString('utf-8'))
  return validation.valid ? validation.data : null
}

export async function getActiveProfileId(jsonFile: JsonFileCap): Promise<string | null> {
  const settings = await jsonFile.settings.read()
  return settings.activeProfileId
}

export async function getProviderConfig(
  jsonFile: JsonFileCap,
  binaryFile: BinaryFileCap,
  providerId: string,
): Promise<ProviderConfig> {
  const profile = await getActiveProfile(jsonFile, binaryFile)
  if (!profile) throw new Error('No active profile')

  const provider = profile.providers.find(p => generateProviderId(p) === providerId)
  if (!provider) throw new Error(`Provider ${providerId} not found in active profile`)

  return {
    type: provider.type,
    apiKey: provider.apiKey ?? null,
    baseUrl: provider.baseUrl ?? null,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Model Discovery
// ─────────────────────────────────────────────────────────────────────────────

export async function syncModels(
  jsonFile: JsonFileCap,
  binaryFile: BinaryFileCap,
  glob: GlobCap,
  aiDep: AiDep,
  logger: Logger,
): Promise<void> {
  const profile = await getActiveProfile(jsonFile, binaryFile)
  const providers = profile ? extractProviders(profile) : []

  if (providers.length === 0) {
    await jsonFile.modelsCache.write([])
    return
  }

  const results = await Promise.allSettled(
    providers.map(async provider => {
      const raw = await aiDep.fetchModels({
        baseUrl: provider.baseUrl ?? undefined,
        apiKey: provider.apiKey ?? undefined,
      })
      return transformModels(raw, provider, new Date().toISOString(), glob.matches)
    })
  )

  const models: CachedModel[] = []
  for (const result of results) {
    if (result.status === 'fulfilled') {
      models.push(...result.value)
    } else {
      logger.error('Provider fetch failed', result.reason as Error)
    }
  }

  await jsonFile.modelsCache.write(models)
  logger.info(`Cache updated with ${models.length} model(s)`)
}

export async function listModels(jsonFile: JsonFileCap): Promise<Model[]> {
  const cached = await jsonFile.modelsCache.read()
  return cached.map(toPublicModel)
}

export async function lookupModelProvider(jsonFile: JsonFileCap, modelId: string): Promise<string> {
  const cached = await jsonFile.modelsCache.read()
  const model = cached.find(m => m.id === modelId)
  if (!model) throw new Error(`Model ${modelId} not found`)
  return model.providerId
}

// ─────────────────────────────────────────────────────────────────────────────
// Favorites
// ─────────────────────────────────────────────────────────────────────────────

export async function mergeFavoriteModels(
  jsonFile: JsonFileCap,
  binaryFile: BinaryFileCap,
): Promise<void> {
  const profile = await getActiveProfile(jsonFile, binaryFile)
  if (!profile?.favoriteModels?.length) return

  const newFavorites = profile.favoriteModels
    .map(({ provider: providerType, model }) => {
      const match = profile.providers.find(p => p.type === providerType)
      if (!match) return null
      return { providerId: generateProviderId(match), modelId: model } as StoredFavorite
    })
    .filter((f): f is StoredFavorite => f !== null)

  if (!newFavorites.length) return

  await jsonFile.settings.update(settings => {
    const existing = new Set(settings.favorites.map(f => `${f.providerId}:${f.modelId}`))
    const toAdd = newFavorites.filter(f => !existing.has(`${f.providerId}:${f.modelId}`))
    return toAdd.length ? { ...settings, favorites: [...settings.favorites, ...toAdd] } : settings
  })
}
