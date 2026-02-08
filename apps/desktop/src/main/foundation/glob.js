import { readdir } from 'node:fs/promises'
import { resolve, sep } from 'node:path'

function matchesGlob(value, pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp('^' + escaped.replace(/\*/g, '.*') + '$')
  return regex.test(value)
}

export const createGlob = (dataDir, allowedPaths) => {
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
    matches: matchesGlob,
    async readdir(relativePath) {
      try {
        const entries = await readdir(resolvePath(relativePath))
        // Filter out hidden files (e.g., .DS_Store on macOS)
        return entries.filter(name => !name.startsWith('.'))
      } catch (error) {
        if (error.code === 'ENOENT') return []
        throw error
      }
    },
  }
}
