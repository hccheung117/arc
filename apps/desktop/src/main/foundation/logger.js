/**
 * Logging Pipeline (FP)
 *
 * Layered architecture:
 *   config → types → formatters → transports → core log → public API
 *
 * All logging flows through a single core function with transport selection.
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
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Formatters
// ─────────────────────────────────────────────────────────────────────────────

const formatConsole = (tag, message, stack) =>
  stack ? `[${tag}] ${message}\n${stack}` : `[${tag}] ${message}`

const formatFile = (level, tag, message, stack) => {
  const timestamp = new Date().toISOString()
  const base = `[${timestamp}] ${level.toUpperCase()} [${tag}] ${message}`
  return stack ? `${base}\n${stack}` : base
}

// ─────────────────────────────────────────────────────────────────────────────
// Transports
// ─────────────────────────────────────────────────────────────────────────────

const toConsole = (level, message) => {
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
  fn(message)
}

const rotateIfOversized = (filePath) => {
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
  const streams = new Map()

  const ensureStream = (filePath) => {
    const existing = streams.get(filePath)
    if (existing) return existing

    rotateIfOversized(filePath)

    const stream = fs.createWriteStream(filePath, { flags: 'a' })
    streams.set(filePath, stream)
    return stream
  }

  return (filePath, content) => {
    ensureStream(filePath).write(content + '\n')
  }
})()

// ─────────────────────────────────────────────────────────────────────────────
// Core Log
// ─────────────────────────────────────────────────────────────────────────────

const log = ({ level, tag, message, stack, filePath }) => {
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
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export const createLogger = (tag) => ({
  info: (message) => info(tag, message),
  warn: (message) => warn(tag, message),
  error: (message, errOrStack) => {
    const stack = typeof errOrStack === 'string' ? errOrStack : errOrStack?.stack
    log({ level: 'error', tag, message, stack, filePath: isDev ? undefined : paths.errorLog() })
  },
})

const info = (tag, message) =>
  log({ level: 'info', tag, message })

const warn = (tag, message) =>
  log({ level: 'warn', tag, message, filePath: isDev ? undefined : paths.errorLog() })
