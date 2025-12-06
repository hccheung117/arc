import { appendFile, mkdir, readFile, unlink } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { z } from 'zod'
import type { IJsonLog } from './types'

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
export class JsonLog<T> implements IJsonLog<T> {
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
      // Silently succeed if file doesn't exist
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return
      }

      // Log other errors but don't throw
      console.warn(`Failed to delete ${this.filePath}:`, error)
    }
  }
}
