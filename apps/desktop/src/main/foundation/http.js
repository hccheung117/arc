/**
 * HTTP Foundation Capability
 *
 * Provides safe HTTP primitives for modules to build upon.
 * Handles common concerns: headers, JSON, streaming, error handling.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Error Factory
// ─────────────────────────────────────────────────────────────────────────────

const createHttpError = (status, statusText, body) => {
  const error = new Error(`HTTP ${status}: ${statusText}`)
  error.name = 'HttpError'
  error.status = status
  error.statusText = statusText
  error.body = body
  return error
}

// ─────────────────────────────────────────────────────────────────────────────
// Core Functions
// ─────────────────────────────────────────────────────────────────────────────

const buildHeaders = (base, custom) => {
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
async function getJson(url, options) {
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

  const data = await response.json()
  return { ok: true, status: response.status, headers: response.headers, data }
}

/**
 * POST request with JSON body, returning JSON.
 */
async function postJson(
  url,
  body,
  options
) {
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

  const data = await response.json()
  return { ok: true, status: response.status, headers: response.headers, data }
}

/**
 * POST request with JSON body, returning SSE stream.
 * Yields parsed JSON objects from each SSE data line.
 */
async function* postJsonStream(
  url,
  body,
  options
) {
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
            yield JSON.parse(json)
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
          yield JSON.parse(trimmed.slice(6))
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

export const createHttp = () => ({
  getJson,
  postJson,
  postJsonStream,
})
