/**
 * Profiles Business Logic
 *
 * Pure repository — no concept of "active" profile or user preferences.
 * Receives context object; zero knowledge of persistence format.
 */

import { randomUUID } from 'crypto'

// ─────────────────────────────────────────────────────────────────────────────
// Pure Functions
// ─────────────────────────────────────────────────────────────────────────────

function passesFilter(modelId, filter, matches) {
  if (!filter || filter.rules.length === 0) return true
  const hit = filter.rules.some(rule => matches(modelId, rule))
  return filter.mode === 'allow' ? hit : !hit
}

function transformModels(
  raw,
  providerInput,
  timestamp,
  matches,
) {
  return raw
    .filter(m => passesFilter(m.id, providerInput.filter ?? null, matches))
    .map(m => ({
      id: m.id,
      name: providerInput.aliases?.[m.id] ?? m.id,
      provider: providerInput.id,
      providerName: providerInput.providerName,
      providerType: 'openai',
      fetchedAt: timestamp,
    }))
}

function toPublicModel(cached) {
  return {
    id: cached.id,
    name: cached.name,
    provider: { id: cached.provider, name: cached.providerName, type: cached.providerType },
  }
}

function extractProviders(profile) {
  return profile.providers.map(p => ({
    id: p.id,
    baseUrl: p.baseUrl,
    apiKey: p.apiKey,
    filter: p.modelFilter,
    aliases: p.modelAliases,
    providerName: profile.name,
  }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Profile Read
// ─────────────────────────────────────────────────────────────────────────────

export async function readProfile(ctx, profileId) {
  const buf = await ctx.binaryFile.readFile(`profiles/${profileId}/arc.json`)
  if (!buf) return null
  const validation = ctx.jsonFile.arcFile.validate(buf.toString('utf-8'))
  return validation.valid ? validation.data : null
}

export async function readProfileSettings(ctx, profileId) {
  const buf = await ctx.binaryFile.readFile(`profiles/${profileId}/settings.json`)
  if (!buf) return null
  const validation = ctx.jsonFile.profileSettings.validate(buf.toString('utf-8'))
  return validation.valid ? validation.data : null
}

// ─────────────────────────────────────────────────────────────────────────────
// Profile Lifecycle
// ─────────────────────────────────────────────────────────────────────────────

export async function installProfile(ctx, archivePath) {
  const { jsonFile, archive, binaryFile } = ctx
  const tempDir = `profiles/.installing-${randomUUID()}`

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

export async function uninstallProfile(ctx, profileId) {
  await ctx.binaryFile.deleteDir(`profiles/${profileId}`)
}

export async function listProfiles(ctx) {
  const { jsonFile, glob, binaryFile } = ctx
  const entries = await glob.listProfileDirs()
  const profiles = []

  for (const entry of entries) {
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

// ─────────────────────────────────────────────────────────────────────────────
// Provider Configuration
// ─────────────────────────────────────────────────────────────────────────────

export async function getProviderConfig(ctx, profileId, providerId) {
  const profile = await readProfile(ctx, profileId)
  if (!profile) throw new Error(`Profile ${profileId} not found`)

  const provider = profile.providers.find(p => p.id === providerId)
  if (!provider) throw new Error(`Provider ${providerId} not found in profile ${profileId}`)

  return {
    type: provider.type,
    apiKey: provider.apiKey ?? null,
    baseUrl: provider.baseUrl ?? null,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Model Discovery
// ─────────────────────────────────────────────────────────────────────────────

export async function syncModels(ctx, profileId) {
  const { jsonFile, glob, ai, logger } = ctx
  const profile = await readProfile(ctx, profileId)
  const providers = profile ? extractProviders(profile) : []

  if (providers.length === 0) {
    await jsonFile.modelsCache.write([])
    return { modelCount: 0, failures: [] }
  }

  const results = await Promise.allSettled(
    providers.map(async provider => {
      const raw = await ai.fetchModels({
        baseUrl: provider.baseUrl ?? undefined,
        apiKey: provider.apiKey ?? undefined,
      })
      return transformModels(raw, provider, new Date().toISOString(), glob.matches)
    })
  )

  const models = []
  const failures = []

  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    if (result.status === 'fulfilled') {
      models.push(...result.value)
    } else {
      const provider = providers[i]
      const error = result.reason instanceof Error ? result.reason.message : 'Unknown error'
      failures.push({ provider: provider.providerName, error })
      logger.error(`Provider "${provider.providerName}" fetch failed`, result.reason)
    }
  }

  await jsonFile.modelsCache.write(models)
  logger.info(`Cache updated with ${models.length} model(s)`)

  return { modelCount: models.length, failures }
}

export async function clearModelsCache(ctx) {
  await ctx.jsonFile.modelsCache.write([])
}

export async function listModels(ctx) {
  const cached = await ctx.jsonFile.modelsCache.read()
  return cached.map(toPublicModel)
}

// ─────────────────────────────────────────────────────────────────────────────
// Stream Configuration
// ─────────────────────────────────────────────────────────────────────────────

export async function getStreamConfig(ctx, profileId, providerId, modelId) {
  const cached = await ctx.jsonFile.modelsCache.read()
  const model = cached.find(m => m.id === modelId && m.provider === providerId)
  if (!model) throw new Error(`Model ${modelId} not found for provider ${providerId}`)

  const providerConfig = await getProviderConfig(ctx, profileId, providerId)
  return {
    modelId,
    providerId,
    baseURL: providerConfig.baseUrl,
    apiKey: providerConfig.apiKey,
  }
}
