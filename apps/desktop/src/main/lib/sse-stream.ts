/**
 * Server-Sent Events (SSE) Stream Parser
 *
 * Parses the text/event-stream format used by OpenAI's streaming API.
 * Handles incomplete chunks across read boundaries gracefully.
 *
 * SSE Format:
 * - Each event is prefixed with "data: "
 * - Events are separated by newlines
 * - Stream ends with "data: [DONE]"
 */

import type { ChatCompletionChunk } from './openai-types'
import { logger } from './logger'

/**
 * Parses a single SSE line into a ChatCompletionChunk.
 * Returns null for empty lines, [DONE], or invalid JSON.
 */
function parseSSELine(line: string): ChatCompletionChunk | null {
  const trimmed = line.trim()

  // Skip empty lines
  if (!trimmed) return null

  // Check for data prefix
  if (!trimmed.startsWith('data:')) return null

  // Extract payload after "data: "
  const payload = trimmed.slice(5).trim()

  // Check for stream termination
  if (payload === '[DONE]') return null

  // Parse JSON
  try {
    return JSON.parse(payload) as ChatCompletionChunk
  } catch {
    logger.warn('sse', `Failed to parse chunk: ${payload.slice(0, 100)}`)
    return null
  }
}

/**
 * Async generator that yields ChatCompletionChunk from a ReadableStream.
 *
 * Handles:
 * - UTF-8 decoding
 * - Buffering partial lines across chunk boundaries
 * - Parsing each complete line as JSON
 *
 * @param stream - ReadableStream from fetch response
 * @yields ChatCompletionChunk for each valid SSE event
 */
export async function* parseSSEStream(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<ChatCompletionChunk> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        // Process any remaining buffer content
        if (buffer.trim()) {
          const chunk = parseSSELine(buffer)
          if (chunk) yield chunk
        }
        break
      }

      // Append decoded text to buffer
      buffer += decoder.decode(value, { stream: true })

      // Process complete lines
      const lines = buffer.split('\n')

      // Keep the last partial line in the buffer
      buffer = lines.pop() ?? ''

      // Yield parsed chunks for complete lines
      for (const line of lines) {
        const chunk = parseSSELine(line)
        if (chunk) yield chunk
      }
    }
  } finally {
    reader.releaseLock()
  }
}
