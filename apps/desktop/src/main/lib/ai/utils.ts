/**
 * Generic Utilities
 *
 * Protocol-level helpers with no AI domain knowledge.
 */

// ============================================================================
// SSE PARSING
// ============================================================================

function parseSSELine<T>(line: string): T | null {
  const trimmed = line.trim()
  if (!trimmed || !trimmed.startsWith('data:')) return null

  const payload = trimmed.slice(5).trim()
  if (payload === '[DONE]') return null

  try {
    return JSON.parse(payload) as T
  } catch {
    return null
  }
}

export async function* parseSSE<T>(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<T> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        if (buffer.trim()) {
          const chunk = parseSSELine<T>(buffer)
          if (chunk) yield chunk
        }
        break
      }

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const chunk = parseSSELine<T>(line)
        if (chunk) yield chunk
      }
    }
  } finally {
    reader.releaseLock()
  }
}
