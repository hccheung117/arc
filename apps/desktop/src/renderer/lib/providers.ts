import { getArc } from './ipc'

export async function updateProviderConfig(
  providerId: string,
  config: { apiKey?: string; baseUrl?: string }
): Promise<void> {
  await getArc().config.set(`provider:${providerId}`, config)
}

export async function getProviderConfig(providerId: string): Promise<{
  apiKey: string | null
  baseUrl: string | null
}> {
  const config = await getArc().config.get<{ apiKey: string | null; baseUrl: string | null }>(`provider:${providerId}`)
  return config ?? { apiKey: null, baseUrl: null }
}
