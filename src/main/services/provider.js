import { resolve, readJson } from '../arcfs.js'
import { getActiveProfile } from './profile.js'

export const listProvidersSensitively = async () => {
  const profile = await getActiveProfile()
  if (!profile) return {}
  return await readJson(resolve('profiles', profile, 'providers.json')) ?? {}
}

export const listProviders = async () => {
  const providers = await listProvidersSensitively()
  return Object.fromEntries(
    Object.entries(providers).map(([id, p]) => [id, { type: p.type, name: p.name, baseUrl: p.baseUrl }])
  )
}

export const getProvider = async (providerId) => {
  const providers = await listProvidersSensitively()
  return providers[providerId] ?? null
}
