/**
 * Application & HTTP Logging
 *
 * Two-tier logging:
 * - App logging: info/warn/error with file rotation in production
 * - HTTP logging: request/response logging for debugging (dev only)
 */

import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

const MAX_LOG_SIZE = 5 * 1024 * 1024 // 5MB

const isDev = !app.isPackaged

// ============================================================================
// APPLICATION LOGGING
// ============================================================================

let logFilePath: string | null = null
let logStream: fs.WriteStream | null = null

/**
 * Initialize log file with rotation.
 * Called lazily on first error in production.
 */
function initLogFile(): void {
  if (logFilePath) return

  logFilePath = path.join(app.getPath('userData'), 'error.log')
  const oldLogPath = path.join(app.getPath('userData'), 'error.old.log')

  // Rotate if file exceeds max size
  try {
    const stats = fs.statSync(logFilePath)
    if (stats.size > MAX_LOG_SIZE) {
      if (fs.existsSync(oldLogPath)) {
        fs.unlinkSync(oldLogPath)
      }
      fs.renameSync(logFilePath, oldLogPath)
    }
  } catch {
    // File doesn't exist yet
  }

  logStream = fs.createWriteStream(logFilePath, { flags: 'a' })
}

function formatTimestamp(): string {
  return new Date().toISOString()
}

function writeToFile(level: string, tag: string, message: string, stack?: string): void {
  if (!logStream) {
    initLogFile()
  }

  const entry = stack
    ? `[${formatTimestamp()}] ${level} [${tag}] ${message}\n${stack}\n`
    : `[${formatTimestamp()}] ${level} [${tag}] ${message}\n`

  logStream?.write(entry)
}

export const logger = {
  /**
   * Info-level log. Dev only.
   */
  info(tag: string, message: string): void {
    if (isDev) {
      console.log(`[${tag}] ${message}`)
    }
  },

  /**
   * Warning-level log. Console in dev, console + file in prod.
   */
  warn(tag: string, message: string): void {
    console.warn(`[${tag}] ${message}`)
    if (!isDev) {
      writeToFile('WARN', tag, message)
    }
  },

  /**
   * Error-level log. Console in dev, console + file in prod.
   */
  error(tag: string, message: string, err?: Error): void {
    const stack = err?.stack

    if (stack) {
      console.error(`[${tag}] ${message}\n${stack}`)
    } else {
      console.error(`[${tag}] ${message}`)
    }

    if (!isDev) {
      writeToFile('ERROR', tag, message, stack)
    }
  },
}

/**
 * Write a renderer error to the log.
 * Console in dev, console + file in prod.
 * Called via IPC from the renderer process.
 */
export function logRendererError(tag: string, message: string, stack?: string): void {
  if (stack) {
    console.error(`[renderer:${tag}] ${message}\n${stack}`)
  } else {
    console.error(`[renderer:${tag}] ${message}`)
  }

  if (!isDev) {
    writeToFile('ERROR', `renderer:${tag}`, message, stack)
  }
}

// ============================================================================
// HTTP DEBUG LOGGING (DEV ONLY)
// ============================================================================

function getHttpLogFilePath(): string {
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
function appendHttpLog(entry: string): void {
  try {
    fs.appendFileSync(getHttpLogFilePath(), entry + '\n')
  } catch {
    // Silently ignore write failures
  }
}

/**
 * Create a fetch wrapper that logs HTTP requests and responses.
 * Only logs in development mode (when app is not packaged).
 */
function createLoggingFetch(): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (app.isPackaged) {
      return fetch(input, init)
    }

    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const method = init?.method ?? 'GET'

    const timestamp = new Date().toISOString()

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

    appendHttpLog(requestLog)

    const response = await fetch(input, init)

    const responseTimestamp = new Date().toISOString()
    let responseLog = `
================================================================================
[${responseTimestamp}] RESPONSE
================================================================================
Status: ${response.status} ${response.statusText}
Headers:
${formatHeaders(response.headers)}`

    const contentType = response.headers.get('content-type') ?? ''
    if (contentType.includes('text/event-stream') || contentType.includes('stream')) {
      responseLog += '\n\nBody: [STREAMING - chunks below]'
      appendHttpLog(responseLog)

      if (response.body) {
        const [logStreamBody, consumerStream] = response.body.tee()

        const reader = logStreamBody.getReader()
        const decoder = new TextDecoder()
        ;(async () => {
          const chunks: string[] = []
          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              chunks.push(decoder.decode(value, { stream: true }))
            }
            const streamLog = `
================================================================================
[${new Date().toISOString()}] STREAM COMPLETE
================================================================================
${chunks.join('')}`
            appendHttpLog(streamLog)
          } catch (err) {
            appendHttpLog(`\n[STREAM ERROR] ${err}`)
          }
        })()

        return new Response(consumerStream, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        })
      }

      return response
    }

    const cloned = response.clone()
    try {
      const body = await cloned.text()
      responseLog += `\n\nBody:\n${prettyJson(body)}`
    } catch {
      responseLog += '\n\nBody: [UNREADABLE]'
    }

    appendHttpLog(responseLog)
    return response
  }
}

/**
 * Singleton logging fetch instance.
 */
export const loggingFetch = createLoggingFetch()
