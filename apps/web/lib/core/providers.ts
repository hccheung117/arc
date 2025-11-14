import { getIPC } from './ipc'

export async function updateProviderConfig(
  providerId: string,
  config: { apiKey?: string; baseUrl?: string },
): Promise<void> {
  await getIPC().updateProviderConfig(providerId, config)
}

export async function getProviderConfig(providerId: string): Promise<{
  apiKey: string | null
  baseUrl: string | null
}> {
  return await getIPC().getProviderConfig(providerId)
}
