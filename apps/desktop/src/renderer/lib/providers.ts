export async function updateProviderConfig(
  providerId: string,
  config: { apiKey?: string; baseUrl?: string }
): Promise<void> {
  await window.arc.settings.set(`provider:${providerId}`, config)
}

export async function getProviderConfig(providerId: string): Promise<{
  apiKey: string | null
  baseUrl: string | null
}> {
  const config = await window.arc.settings.get<{ apiKey: string | null; baseUrl: string | null }>(`provider:${providerId}`)
  return config ?? { apiKey: null, baseUrl: null }
}
