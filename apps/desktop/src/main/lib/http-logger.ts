import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

function getLogFilePath(): string {
  const appPath = app.getAppPath()
  const repoRoot = path.resolve(appPath, '../..')
  return path.join(repoRoot, 'http.log')
}

/**
 * Mask sensitive values in headers (API keys, tokens).
 */
function maskSensitive(key: string, value: string): string {
  const sensitiveKeys = ['authorization', 'x-api-key', 'api-key']
  if (sensitiveKeys.includes(key.toLowerCase()) && value.length > 10) {
    return value.slice(0, -4).replace(/./g, '*') + value.slice(-4)
  }
  return value
}

/**
 * Format headers for logging.
 */
function formatHeaders(headers: HeadersInit | undefined): string {
  if (!headers) return '  (none)'

  const entries: [string, string][] =
    headers instanceof Headers
      ? [...headers.entries()]
      : Array.isArray(headers)
        ? headers
        : Object.entries(headers)

  return entries
    .map(([k, v]) => `  ${k}: ${maskSensitive(k, v)}`)
    .join('\n')
}

/**
 * Pretty print JSON, handling non-JSON gracefully.
 */
function prettyJson(data: unknown): string {
  if (typeof data === 'string') {
    try {
      return JSON.stringify(JSON.parse(data), null, 2)
    } catch {
      return data
    }
  }
  return JSON.stringify(data, null, 2)
}

/**
 * Append a log entry to the HTTP log file.
 */
function appendLog(entry: string): void {
  try {
    fs.appendFileSync(getLogFilePath(), entry + '\n')
  } catch {
    // Silently ignore write failures
  }
}

/**
 * Create a fetch wrapper that logs HTTP requests and responses.
 * Only logs in development mode (when app is not packaged).
 */
export function createLoggingFetch(): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    // Skip logging in production
    if (app.isPackaged) {
      return fetch(input, init)
    }

    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const method = init?.method ?? 'GET'

    const timestamp = new Date().toISOString()

    // Log request
    let requestLog = `
================================================================================
[${timestamp}] REQUEST
================================================================================
${method} ${url}
Headers:
${formatHeaders(init?.headers)}`

    if (init?.body) {
      requestLog += `\n\nBody:\n${prettyJson(init.body)}`
    }

    appendLog(requestLog)

    // Execute the request
    const response = await fetch(input, init)

    // Log response
    const responseTimestamp = new Date().toISOString()
    let responseLog = `
================================================================================
[${responseTimestamp}] RESPONSE
================================================================================
Status: ${response.status} ${response.statusText}
Headers:
${formatHeaders(response.headers)}`

    // Check if streaming response
    const contentType = response.headers.get('content-type') ?? ''
    if (contentType.includes('text/event-stream') || contentType.includes('stream')) {
      responseLog += '\n\nBody: [STREAMING - chunks below]'
      appendLog(responseLog)

      // Tee the stream: one for logging, one for the consumer
      if (response.body) {
        const [logStream, consumerStream] = response.body.tee()

        // Log chunks asynchronously
        const reader = logStream.getReader()
        const decoder = new TextDecoder()
        ;(async () => {
          const chunks: string[] = []
          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              chunks.push(decoder.decode(value, { stream: true }))
            }
            // Log all chunks at the end
            const streamLog = `
================================================================================
[${new Date().toISOString()}] STREAM COMPLETE
================================================================================
${chunks.join('')}`
            appendLog(streamLog)
          } catch (err) {
            appendLog(`\n[STREAM ERROR] ${err}`)
          }
        })()

        // Return new response with the consumer stream
        return new Response(consumerStream, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        })
      }

      return response
    }

    // For non-streaming, clone and read body
    const cloned = response.clone()
    try {
      const body = await cloned.text()
      responseLog += `\n\nBody:\n${prettyJson(body)}`
    } catch {
      responseLog += '\n\nBody: [UNREADABLE]'
    }

    appendLog(responseLog)
    return response
  }
}

/**
 * Singleton logging fetch instance.
 */
export const loggingFetch = createLoggingFetch()
