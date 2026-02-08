import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import { dialog, BrowserWindow } from 'electron'
import matter, { stringify } from 'gray-matter'

export const createMarkdownFile = (dataDir, allowedPaths) => {
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
    async read(relativePath) {
      try {
        const raw = await readFile(resolvePath(relativePath), 'utf-8')
        const { data, content } = matter(raw)
        return { frontMatter: data, body: content.trim() }
      } catch (error) {
        if (error.code === 'ENOENT') return null
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

    async saveAs(content, options) {
      const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      const result = await dialog.showSaveDialog(window, {
        defaultPath: options?.defaultPath,
        filters: options?.filters,
      })
      if (result.canceled || !result.filePath) return null
      await writeFile(result.filePath, content, 'utf-8')
      return result.filePath
    },
  }
}
