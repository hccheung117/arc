/**
 * OpenAI HTTP Layer
 *
 * Two-layer architecture:
 * 1. Configured fetch wrapper (base URL, auth, error handling)
 * 2. Endpoint functions bound to the client
 */

const OPENAI_BASE_URL = 'https://api.openai.com/v1'

// --- Types ---

type RequestFn = (path: string, init?: RequestInit) => Promise<Response>

// --- Pure functions ---

async function extractErrorMessage(response: Response): Promise<string> {
  const fallback = `HTTP ${response.status}: ${response.statusText}`
  try {
    const body = (await response.json()) as { error?: { message?: string } }
    return body.error?.message ?? fallback
  } catch {
    return fallback
  }
}

// --- Endpoint functions ---

const listModels =
  (request: RequestFn) => async (): Promise<Array<{ id: string }>> => {
    const res = await request('/models')
    const data = (await res.json()) as { data: Array<{ id: string }> }
    return data.data
  }

const streamChatCompletions =
  (request: RequestFn) =>
  async (
    body: Record<string, unknown>,
    signal: AbortSignal,
  ): Promise<ReadableStream<Uint8Array>> => {
    const res = await request('/chat/completions', {
      method: 'POST',
      body: JSON.stringify({ ...body, stream: true }),
      signal,
    })
    if (!res.body) {
      throw new Error('Response body is null')
    }
    return res.body
  }

// --- Client factory ---

export function createClient(input: {
  baseUrl?: string | null
  apiKey?: string | null
}) {
  const baseUrl = input.baseUrl ?? OPENAI_BASE_URL
  const apiKey = input.apiKey ?? undefined

  const request: RequestFn = async (path, init) => {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
        ...init?.headers,
      },
    })
    if (!response.ok) {
      throw new Error(await extractErrorMessage(response))
    }
    return response
  }

  return {
    listModels: listModels(request),
    streamChatCompletions: streamChatCompletions(request),
  }
}
