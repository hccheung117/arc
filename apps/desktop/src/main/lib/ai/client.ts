/**
 * Arc API client for model listing
 * Independent of AI SDK - used for provider configuration UI
 */

type ClientSettings = {
  baseUrl?: string | null
  apiKey?: string | null
}

export function createClient(settings: ClientSettings) {
  const baseURL = settings.baseUrl ?? 'https://api.openai.com/v1'

  return {
    async listModels() {
      const response = await fetch(`${baseURL}/models`, {
        headers: {
          'Content-Type': 'application/json',
          ...(settings.apiKey && { Authorization: `Bearer ${settings.apiKey}` }),
        },
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText)
        throw new Error(`Failed to list models: ${errorText}`)
      }

      const data = (await response.json()) as { data: Array<{ id: string }> }
      return data.data
    },
  }
}
