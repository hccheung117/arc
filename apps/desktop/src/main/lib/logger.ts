import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

const MAX_LOG_SIZE = 5 * 1024 * 1024 // 5MB

const isDev = !app.isPackaged

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
   * Warning-level log. Dev only.
   */
  warn(tag: string, message: string): void {
    if (isDev) {
      console.warn(`[${tag}] ${message}`)
    }
  },

  /**
   * Error-level log. Console in dev, file in prod.
   */
  error(tag: string, message: string, err?: Error): void {
    const stack = err?.stack

    if (isDev) {
      if (stack) {
        console.error(`[${tag}] ${message}\n${stack}`)
      } else {
        console.error(`[${tag}] ${message}`)
      }
    } else {
      writeToFile('ERROR', tag, message, stack)
    }
  },
}

/**
 * Write a renderer error to the log file.
 * Called via IPC from the renderer process in production.
 */
export function logRendererError(tag: string, message: string, stack?: string): void {
  if (isDev) {
    if (stack) {
      console.error(`[renderer:${tag}] ${message}\n${stack}`)
    } else {
      console.error(`[renderer:${tag}] ${message}`)
    }
  } else {
    writeToFile('ERROR', `renderer:${tag}`, message, stack)
  }
}
