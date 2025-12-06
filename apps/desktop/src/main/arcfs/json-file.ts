import { mkdir, readFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import writeFileAtomic from 'write-file-atomic'
import type { z } from 'zod'
import type { IJsonFile } from './types'

/**
 * Atomic file persistence engine for Config and Ledger archetypes.
 *
 * Guarantees:
 * - Atomicity: Files are never partially written. Write-replace strategy ensures consistency.
 * - Validation: Data is validated against a Zod schema on read.
 * - Simplicity: Automatically creates parent directories and handles serialization.
 *
 * Usage:
 * ```ts
 * const settings = new JsonFile('/path/to/settings.json', defaultSettings, SettingsSchema)
 * const data = await settings.read() // Returns default if file doesn't exist, throws on invalid
 * await settings.write({ theme: 'light' })
 * await settings.update(data => ({ ...data, locale: 'en' }))
 * ```
 */
export class JsonFile<T> implements IJsonFile<T> {
  constructor(
    private readonly filePath: string,
    private readonly defaultValue: T,
    private readonly schema: z.ZodType<T>
  ) {}

  async read(): Promise<T> {
    try {
      const content = await readFile(this.filePath, 'utf-8')
      const parsed = JSON.parse(content)
      return this.schema.parse(parsed)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return this.defaultValue
      }
      throw error
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
