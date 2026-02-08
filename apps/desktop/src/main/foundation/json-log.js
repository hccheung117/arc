import { appendFile, copyFile as fsCopyFile, mkdir, readFile, unlink } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import { z } from 'zod'

/**
 * Append-only log persistence engine for Stream archetype.
 *
 * Guarantees:
 * - Immutability: Data is never rewritten. New entries are always appended.
 * - Crash Safety: Partial writes only affect the last line. History is preserved.
 * - Validation: Each line is validated against a Zod schema on read.
 * - Performance: Large datasets never require full rewrites.
 *
 * Format: JSON Lines (JSONL) - one JSON object per line.
 *
 * Usage:
 * ```js
 * const log = new JsonLog('/path/to/messages.jsonl', MessageSchema)
 * await log.append({ id: '1', content: 'Hello' })
 * await log.append({ id: '2', content: 'World' })
 * const messages = await log.read() // Returns array of all messages, throws on invalid
 * await log.delete() // Remove the log file
 * ```
 */
class JsonLog {
  constructor(
    filePath,
    schema
  ) {
    this.filePath = filePath
    this.schema = schema
  }

  async append(item) {
    await mkdir(dirname(this.filePath), { recursive: true })
    const line = JSON.stringify(item) + '\n'
    await appendFile(this.filePath, line, 'utf-8')
  }

  async read() {
    try {
      const content = await readFile(this.filePath, 'utf-8')
      const lines = content.split('\n').filter(line => line.trim().length > 0)

      return lines.map((line, index) => {
        const parsed = JSON.parse(line)
        const result = this.schema.safeParse(parsed)
        if (!result.success) {
          throw new Error(
            `Invalid data at line ${index + 1} in ${this.filePath}: ${result.error.issues[0].message}`
          )
        }
        return result.data
      })
    } catch (error) {
      if (error.code === 'ENOENT') {
        return []
      }
      throw error
    }
  }

  async delete() {
    try {
      await unlink(this.filePath)
    } catch (error) {
      // Silently succeed if file doesn't exist or other non-critical errors
      if (error.code === 'ENOENT') {
        return
      }
      // Other errors are silently ignored - delete is best-effort
    }
  }
}

export const createJsonLog = (dataDir, allowedPaths) => {
  const resolvedDataDir = resolve(dataDir)

  const rules = allowedPaths.map(p => ({
    resolved: resolve(resolvedDataDir, p.replace(/\/$/, '')),
    isDir: p.endsWith('/'),
  }))

  const resolvePath = (relativePath) => {
    const full = resolve(resolvedDataDir, relativePath)

    const allowed = rules.some(rule =>
      rule.isDir
        ? (full.startsWith(rule.resolved + sep) || full === rule.resolved)
        : full === rule.resolved
    )

    if (!allowed) throw new Error(`Path access denied: ${relativePath}`)
    return full
  }

  return {
    create: (relativePath, schema) => new JsonLog(resolvePath(relativePath), schema),

    async copyFile(srcPath, dstPath) {
      const src = resolvePath(srcPath)
      const dst = resolvePath(dstPath)
      await mkdir(dirname(dst), { recursive: true })
      try {
        await fsCopyFile(src, dst)
      } catch (error) {
        if (error.code === 'ENOENT') return
        throw error
      }
    },
  }
}
