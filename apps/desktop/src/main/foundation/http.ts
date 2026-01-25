/**
 * HTTP Foundation Capability
 *
 * Provides safe HTTP primitives for modules to build upon.
 * Handles common concerns: headers, JSON, streaming, error handling.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface HttpRequestOptions {
  headers?: Record<string, string>
  signal?: AbortSignal
}

export interface HttpResponse<T> {
  ok: boolean
  status: number
  headers: Headers
  data: T
}

export interface HttpError extends Error {
  status: number
  statusText: string
  body?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Error Factory
// ─────────────────────────────────────────────────────────────────────────────

const createHttpError = (status: number, statusText: string, body?: string): HttpError => {
  const error = new Error(`HTTP ${status}: ${statusText}`) as HttpError
  error.name = 'HttpError'
  error.status = status
  error.statusText = statusText
  error.body = body
  return error
}

// ─────────────────────────────────────────────────────────────────────────────
// Core Functions
// ─────────────────────────────────────────────────────────────────────────────

const buildHeaders = (base: Record<string, string>, custom?: Record<string, string>): Headers => {
  const headers = new Headers(base)
  if (custom) {
    for (const [key, value] of Object.entries(custom)) {
      headers.set(key, value)
    }
  }
  return headers
}

/**
 * GET request returning JSON.
 */
async function getJson<T>(url: string, options?: HttpRequestOptions): Promise<HttpResponse<T>> {
  const headers = buildHeaders({ 'Content-Type': 'application/json' }, options?.headers)

  const response = await fetch(url, {
    method: 'GET',
    headers,
    signal: options?.signal,
  })

  if (!response.ok) {
    const body = await response.text().catch(() => response.statusText)
    throw createHttpError(response.status, response.statusText, body)
  }

  const data = (await response.json()) as T
  return { ok: true, status: response.status, headers: response.headers, data }
}

/**
 * POST request with JSON body, returning JSON.
 */
async function postJson<T>(
  url: string,
  body: unknown,
  options?: HttpRequestOptions
): Promise<HttpResponse<T>> {
  const headers = buildHeaders({ 'Content-Type': 'application/json' }, options?.headers)

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: options?.signal,
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => response.statusText)
    throw createHttpError(response.status, response.statusText, errorBody)
  }

  const data = (await response.json()) as T
  return { ok: true, status: response.status, headers: response.headers, data }
}

/**
 * POST request with JSON body, returning SSE stream.
 * Yields parsed JSON objects from each SSE data line.
 */
async function* postJsonStream<T>(
  url: string,
  body: unknown,
  options?: HttpRequestOptions
): AsyncGenerator<T> {
  const headers = buildHeaders({ 'Content-Type': 'application/json' }, options?.headers)

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: options?.signal,
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => response.statusText)
    throw createHttpError(response.status, response.statusText, errorBody)
  }

  if (!response.body) {
    throw new Error('Response body is null')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith(':')) continue
        if (trimmed === 'data: [DONE]') return

        if (trimmed.startsWith('data: ')) {
          const json = trimmed.slice(6)
          try {
            yield JSON.parse(json) as T
          } catch {
            // Skip malformed JSON
          }
        }
      }
    }

    // Process remaining buffer
    if (buffer.trim()) {
      const trimmed = buffer.trim()
      if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
        try {
          yield JSON.parse(trimmed.slice(6)) as T
        } catch {
          // Skip malformed JSON
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export interface Http {
  getJson: typeof getJson
  postJson: typeof postJson
  postJsonStream: typeof postJsonStream
}

export const createHttp = (): Http => ({
  getJson,
  postJson,
  postJsonStream,
})
