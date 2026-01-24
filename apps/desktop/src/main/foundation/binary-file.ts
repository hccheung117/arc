import { copyFile as fsCopyFile, cp, mkdir, readFile, rename as fsRename, rm, unlink, writeFile } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'

/**
 * Raw binary file persistence for non-JSON data (attachments, images).
 *
 * Guarantees:
 * - Path Scoping: Operations restricted to declared allowed paths.
 * - Directory Safety: Parent directories created automatically on write.
 * - Graceful Absence: Read returns null, delete/copy silently succeed on missing files.
 */

export interface ScopedBinaryFile {
  write: (relativePath: string, buffer: Buffer) => Promise<void>
  read: (relativePath: string) => Promise<Buffer | null>
  delete: (relativePath: string) => Promise<void>
  deleteDir: (relativePath: string) => Promise<void>
  rename: (srcPath: string, dstPath: string) => Promise<void>
  copyFile: (srcPath: string, dstPath: string) => Promise<void>
  copyDir: (srcPath: string, dstPath: string) => Promise<void>
}

export const createBinaryFile = (dataDir: string, allowedPaths: readonly string[]): ScopedBinaryFile => {
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
    async write(relativePath, buffer) {
      const full = resolvePath(relativePath)
      await mkdir(dirname(full), { recursive: true })
      await writeFile(full, buffer)
    },

    async read(relativePath) {
      try {
        return await readFile(resolvePath(relativePath))
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
        throw error
      }
    },

    async delete(relativePath) {
      try {
        await unlink(resolvePath(relativePath))
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
        throw error
      }
    },

    async deleteDir(relativePath) {
      try {
        await rm(resolvePath(relativePath), { recursive: true, force: true })
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
        throw error
      }
    },

    async rename(srcPath, dstPath) {
      const src = resolvePath(srcPath)
      const dst = resolvePath(dstPath)
      await mkdir(dirname(dst), { recursive: true })
      await fsRename(src, dst)
    },

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

    async copyDir(srcPath, dstPath) {
      const src = resolvePath(srcPath)
      const dst = resolvePath(dstPath)
      try {
        await cp(src, dst, { recursive: true })
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
        throw error
      }
    },
  }
}
