import { appendFile, copyFile as fsCopyFile, mkdir, readFile, unlink } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import type { z } from 'zod'

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
 * ```ts
 * const log = new JsonLog('/path/to/messages.jsonl', MessageSchema)
 * await log.append({ id: '1', content: 'Hello' })
 * await log.append({ id: '2', content: 'World' })
 * const messages = await log.read() // Returns array of all messages, throws on invalid
 * await log.delete() // Remove the log file
 * ```
 */
class JsonLog<T> {
  constructor(
    private readonly filePath: string,
    private readonly schema: z.ZodType<T>
  ) {}

  async append(item: T): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true })
    const line = JSON.stringify(item) + '\n'
    await appendFile(this.filePath, line, 'utf-8')
  }

  async read(): Promise<T[]> {
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
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return []
      }
      throw error
    }
  }

  async delete(): Promise<void> {
    try {
      await unlink(this.filePath)
    } catch (error) {
      // Silently succeed if file doesn't exist or other non-critical errors
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return
      }
      // Other errors are silently ignored - delete is best-effort
    }
  }
}

export interface ScopedJsonLog {
  create: <T>(relativePath: string, schema: z.ZodType<T>) => JsonLog<T>
  copyFile: (srcPath: string, dstPath: string) => Promise<void>
}

export const createJsonLog = (dataDir: string, allowedPaths: readonly string[]): ScopedJsonLog => {
  const resolvedDataDir = resolve(dataDir)

  const rules = allowedPaths.map(p => ({
    resolved: resolve(resolvedDataDir, p.replace(/\/$/, '')),
    isDir: p.endsWith('/'),
  }))

  const resolvePath = (relativePath: string): string => {
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
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
        throw error
      }
    },
  }
}
