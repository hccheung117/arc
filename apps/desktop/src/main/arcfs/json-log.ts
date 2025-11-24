import { appendFile, mkdir, readFile, unlink } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { IJsonLog } from './types'

/**
 * Append-only log persistence engine for Stream archetype.
 *
 * Guarantees:
 * - Immutability: Data is never rewritten. New entries are always appended.
 * - Crash Safety: Partial writes only affect the last line. History is preserved.
 * - Performance: Large datasets never require full rewrites.
 *
 * Format: JSON Lines (JSONL) - one JSON object per line.
 *
 * Usage:
 * ```ts
 * const log = new JsonLog<Message>('/path/to/messages.jsonl')
 * await log.append({ id: '1', content: 'Hello' })
 * await log.append({ id: '2', content: 'World' })
 * const messages = await log.read() // Returns array of all messages
 * await log.delete() // Remove the log file
 * ```
 */
export class JsonLog<T> implements IJsonLog<T> {
  constructor(private readonly filePath: string) {}

  async append(item: T): Promise<void> {
    // Ensure parent directory exists
    await mkdir(dirname(this.filePath), { recursive: true })

    // Serialize item and append as a single line
    const line = JSON.stringify(item) + '\n'
    await appendFile(this.filePath, line, 'utf-8')
  }

  async read(): Promise<T[]> {
    try {
      const content = await readFile(this.filePath, 'utf-8')

      // Split by newlines and parse each non-empty line
      return content
        .split('\n')
        .filter(line => line.trim().length > 0)
        .map((line, index) => {
          try {
            return JSON.parse(line) as T
          } catch (error) {
            // Log parse error but don't fail the entire read
            console.warn(`Failed to parse line ${index + 1} in ${this.filePath}:`, error)
            return null
          }
        })
        .filter((item): item is T => item !== null)
    } catch (error) {
      // File doesn't exist - return empty array
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return []
      }

      // Other errors - log and return empty array
      console.error(`Failed to read ${this.filePath}:`, error)
      return []
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
