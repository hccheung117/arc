import { mkdir, readFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import writeFileAtomic from 'write-file-atomic'
import type { IJsonFile } from './types'

/**
 * Atomic file persistence engine for Config and Ledger archetypes.
 *
 * Guarantees:
 * - Atomicity: Files are never partially written. Write-replace strategy ensures consistency.
 * - Safety: Returns default value if file is missing or corrupted.
 * - Simplicity: Automatically creates parent directories and handles serialization.
 *
 * Usage:
 * ```ts
 * const settings = new JsonFile('/path/to/settings.json', { theme: 'dark' })
 * const data = await settings.read() // Returns default if file doesn't exist
 * await settings.write({ theme: 'light' })
 * await settings.update(data => ({ ...data, locale: 'en' }))
 * ```
 */
export class JsonFile<T> implements IJsonFile<T> {
  constructor(
    private readonly filePath: string,
    private readonly defaultValue: T
  ) {}

  async read(): Promise<T> {
    try {
      const content = await readFile(this.filePath, 'utf-8')
      return JSON.parse(content) as T
    } catch (error) {
      // File doesn't exist or is corrupted - return default value
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return this.defaultValue
      }

      // Parse error - log warning and return default
      console.warn(`Failed to parse ${this.filePath}, using default:`, error)
      return this.defaultValue
    }
  }

  async write(data: T): Promise<void> {
    // Ensure parent directory exists
    await mkdir(dirname(this.filePath), { recursive: true })

    // Atomic write: serialize to temp file, then rename over original
    const content = JSON.stringify(data, null, 2)
    await writeFileAtomic(this.filePath, content, { encoding: 'utf-8' })
  }

  async update(updater: (data: T) => T): Promise<void> {
    const current = await this.read()
    const updated = updater(current)
    await this.write(updated)
  }
}
