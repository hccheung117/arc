import { readdir } from 'node:fs/promises'
import { resolve, sep } from 'node:path'

function matchesGlob(value: string, pattern: string) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp('^' + escaped.replace(/\*/g, '.*') + '$')
  return regex.test(value)
}

export interface ScopedGlob {
  matches: (value: string, pattern: string) => boolean
  readdir: (relativePath: string) => Promise<string[]>
}

export const createGlob = (dataDir: string, allowedPaths: readonly string[]): ScopedGlob => {
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
    matches: matchesGlob,
    async readdir(relativePath) {
      try {
        return await readdir(resolvePath(relativePath))
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
        throw error
      }
    },
  }
}
