import { mkdir, readFile } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import writeFileAtomic from 'write-file-atomic'

/**
 * Atomic file persistence engine for Config and Ledger archetypes.
 *
 * Guarantees:
 * - Atomicity: Files are never partially written. Write-replace strategy ensures consistency.
 * - Validation: Data is validated against a Zod schema on read.
 * - Simplicity: Automatically creates parent directories and handles serialization.
 *
 * Usage:
 * ```js
 * const settings = new JsonFile('/path/to/settings.json', defaultSettings, SettingsSchema)
 * const data = await settings.read() // Returns default if file doesn't exist, throws on invalid
 * await settings.write({ theme: 'light' })
 * await settings.update(data => ({ ...data, locale: 'en' }))
 * ```
 */
class JsonFile {
  constructor(
    filePath,
    defaultValue,
    schema
  ) {
    this.filePath = filePath
    this.defaultValue = defaultValue
    this.schema = schema
  }

  async read() {
    try {
      const content = await readFile(this.filePath, 'utf-8')
      const parsed = JSON.parse(content)
      // Merge with defaults to handle schema evolution (new fields added over time)
      const merged = { ...this.defaultValue, ...parsed }
      return this.schema.parse(merged)
    } catch (error) {
      if (error.code === 'ENOENT') {
        return this.defaultValue
      }
      throw error
    }
  }

  async write(data) {
    // Ensure parent directory exists
    await mkdir(dirname(this.filePath), { recursive: true })

    // Atomic write: serialize to temp file, then rename over original
    const content = JSON.stringify(data, null, 2)
    await writeFileAtomic(this.filePath, content, { encoding: 'utf-8' })
  }

  async update(updater) {
    const current = await this.read()
    const updated = updater(current)
    await this.write(updated)
  }
}

export const createJsonFile = (dataDir, allowedPaths) => {
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
    create: (relativePath, defaultValue, schema) =>
      new JsonFile(resolvePath(relativePath), defaultValue, schema),
  }
}
