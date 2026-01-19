/**
 * Logging Pipeline (FP)
 *
 * Layered architecture:
 *   config → types → formatters → transports → core log → public API
 *
 * All logging flows through a single core function with transport selection.
 * HTTP logging is dev-only and builds on the same transport layer.
 */

import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

// ─────────────────────────────────────────────────────────────────────────────
// Config & Constants
// ─────────────────────────────────────────────────────────────────────────────

const isDev = !app.isPackaged

const MAX_LOG_SIZE = 5 * 1024 * 1024

const paths = {
  errorLog: () => path.join(app.getPath('userData'), 'error.log'),
  httpLog: () => path.join(path.resolve(app.getAppPath(), '../..'), 'http.log'),
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

const Level = {
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
} as const
type Level = (typeof Level)[keyof typeof Level]

interface LogEntry {
  level: Level
  tag: string
  message: string
  stack?: string
  filePath?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatters
// ─────────────────────────────────────────────────────────────────────────────

const formatConsole = (tag: string, message: string, stack?: string): string =>
  stack ? `[${tag}] ${message}\n${stack}` : `[${tag}] ${message}`

const formatFile = (level: Level, tag: string, message: string, stack?: string): string => {
  const timestamp = new Date().toISOString()
  const base = `[${timestamp}] ${level.toUpperCase()} [${tag}] ${message}`
  return stack ? `${base}\n${stack}` : base
}

const prettyJson = (data: unknown): string => {
  if (typeof data === 'string') {
    try {
      return JSON.stringify(JSON.parse(data), null, 2)
    } catch {
      return data
    }
  }
  return JSON.stringify(data, null, 2)
}

const maskSensitive = (key: string, value: string): string => {
  const sensitive = ['authorization', 'x-api-key', 'api-key']
  if (sensitive.includes(key.toLowerCase()) && value.length > 10) {
    return value.slice(0, -4).replace(/./g, '*') + value.slice(-4)
  }
  return value
}

const formatHeaders = (headers: HeadersInit | undefined): string => {
  if (!headers) return '  (none)'

  const entries: [string, string][] =
    headers instanceof Headers
      ? [...headers.entries()]
      : Array.isArray(headers)
        ? headers
        : Object.entries(headers)

  return entries.map(([k, v]) => `  ${k}: ${maskSensitive(k, v)}`).join('\n')
}

// ─────────────────────────────────────────────────────────────────────────────
// Transports
// ─────────────────────────────────────────────────────────────────────────────

const toConsole = (level: Level, message: string): void => {
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
  fn(message)
}

const rotateIfOversized = (filePath: string): void => {
  try {
    const stats = fs.statSync(filePath)
    if (stats.size > MAX_LOG_SIZE) {
      const oldPath = filePath.replace(/\.log$/, '.old.log')
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath)
      fs.renameSync(filePath, oldPath)
    }
  } catch {
    // File doesn't exist yet
  }
}

const toFile = (() => {
  const streams = new Map<string, fs.WriteStream>()

  const ensureStream = (filePath: string): fs.WriteStream => {
    const existing = streams.get(filePath)
    if (existing) return existing

    rotateIfOversized(filePath)

    const stream = fs.createWriteStream(filePath, { flags: 'a' })
    streams.set(filePath, stream)
    return stream
  }

  return (filePath: string, content: string): void => {
    ensureStream(filePath).write(content + '\n')
  }
})()

// ─────────────────────────────────────────────────────────────────────────────
// Core Log
// ─────────────────────────────────────────────────────────────────────────────

const log = ({ level, tag, message, stack, filePath }: LogEntry): void => {
  // Console: dev gets all, prod gets warn/error only
  if (isDev || level !== 'info') {
    toConsole(level, formatConsole(tag, message, stack))
  }

  // File: when path provided
  if (filePath) {
    toFile(filePath, formatFile(level, tag, message, stack))
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP Logging Internals (dev only)
// ─────────────────────────────────────────────────────────────────────────────

const HTTP_SEPARATOR = '================================================================================'

const httpLog = (message: string): void => {
  if (!isDev) return
  toFile(paths.httpLog(), message)
}

const logHttpRequest = (method: string, url: string, headers: HeadersInit | undefined, body?: BodyInit | null): void => {
  const timestamp = new Date().toISOString()
  let entry = `\n${HTTP_SEPARATOR}\n[${timestamp}] REQUEST\n${HTTP_SEPARATOR}\n${method} ${url}\nHeaders:\n${formatHeaders(headers)}`
  if (body) entry += `\n\nBody:\n${prettyJson(body)}`
  httpLog(entry)
}

const logHttpResponse = (status: number, statusText: string, headers: Headers, body?: string): void => {
  const timestamp = new Date().toISOString()
  let entry = `\n${HTTP_SEPARATOR}\n[${timestamp}] RESPONSE\n${HTTP_SEPARATOR}\nStatus: ${status} ${statusText}\nHeaders:\n${formatHeaders(headers)}`
  if (body !== undefined) entry += `\n\nBody:\n${body}`
  httpLog(entry)
}

const logHttpStreamComplete = (content: string): void => {
  const timestamp = new Date().toISOString()
  httpLog(`\n${HTTP_SEPARATOR}\n[${timestamp}] STREAM COMPLETE\n${HTTP_SEPARATOR}\n${content}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export interface Logger {
  info: (message: string) => void
  warn: (message: string) => void
  error: (message: string, err?: Error) => void
}

export const createLogger = (tag: string): Logger => ({
  info: (message) => info(tag, message),
  warn: (message) => warn(tag, message),
  error: (message, err) => error(tag, message, err),
})

export const info = (tag: string, message: string): void =>
  log({ level: 'info', tag, message })

export const warn = (tag: string, message: string): void =>
  log({ level: 'warn', tag, message, filePath: isDev ? undefined : paths.errorLog() })

export const error = (tag: string, message: string, err?: Error): void =>
  log({ level: 'error', tag, message, stack: err?.stack, filePath: isDev ? undefined : paths.errorLog() })

export const rendererError = (tag: string, message: string, stack?: string): void =>
  log({ level: 'error', tag: `renderer:${tag}`, message, stack, filePath: isDev ? undefined : paths.errorLog() })

/**
 * Drop-in fetch wrapper that logs HTTP traffic to http.log (dev only).
 * Handles both streaming and standard responses.
 */
export const logFetch: typeof fetch = async (input, init) => {
  if (!isDev) return fetch(input, init)

  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const method = init?.method ?? 'GET'

  logHttpRequest(method, url, init?.headers, init?.body)

  const response = await fetch(input, init)
  const contentType = response.headers.get('content-type') ?? ''

  // Streaming response
  if (contentType.includes('text/event-stream') || contentType.includes('stream')) {
    logHttpResponse(response.status, response.statusText, response.headers, '[STREAMING]')

    if (response.body) {
      const [logStream, consumerStream] = response.body.tee()
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
          logHttpStreamComplete(chunks.join(''))
        } catch (err) {
          httpLog(`\n[STREAM ERROR] ${err}`)
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

  // Standard response
  const cloned = response.clone()
  try {
    const body = await cloned.text()
    logHttpResponse(response.status, response.statusText, response.headers, prettyJson(body))
  } catch {
    logHttpResponse(response.status, response.statusText, response.headers, '[UNREADABLE]')
  }

  return response
}
