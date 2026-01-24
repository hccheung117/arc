import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import matter, { stringify } from 'gray-matter'

export interface MarkdownContent {
  frontMatter: Record<string, unknown>
  body: string
}

export interface ScopedMarkdownFile {
  read: (relativePath: string) => Promise<MarkdownContent | null>
  write: (relativePath: string, body: string, frontMatter?: Record<string, unknown>) => Promise<void>
}

export const createMarkdownFile = (dataDir: string, allowedPaths: readonly string[]): ScopedMarkdownFile => {
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
    async read(relativePath) {
      try {
        const raw = await readFile(resolvePath(relativePath), 'utf-8')
        const { data, content } = matter(raw)
        return { frontMatter: data, body: content.trim() }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
        throw error
      }
    },

    async write(relativePath, body, frontMatter) {
      const full = resolvePath(relativePath)
      await mkdir(dirname(full), { recursive: true })

      const content = frontMatter && Object.keys(frontMatter).length > 0
        ? stringify(body, frontMatter)
        : body

      await writeFile(full, content, 'utf-8')
    },
  }
}
