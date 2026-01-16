/**
 * Window State I/O Boundary
 *
 * Disk persistence for window size cache.
 * Exports typed storage accessors; schemas remain private.
 */

import { z } from 'zod'
import { screen, type BrowserWindow } from 'electron'
import { readFile, mkdir, readdir, unlink } from 'node:fs/promises'
import { dirname, basename } from 'node:path'
import writeFileAtomic from 'write-file-atomic'
import { getWindowStateCachePath } from '@main/foundation/paths'
import { warn, error } from '@main/foundation/logger'

// ============================================================================
// PRIVATE SCHEMAS
// ============================================================================

const WindowStateSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
})

// ============================================================================
// PUBLIC TYPES & CONSTANTS
// ============================================================================

export type WindowState = z.infer<typeof WindowStateSchema>

export const DEFAULT_SIZE = { width: 800, height: 600 }
export const MIN_SIZE = { width: 700, height: 550 }

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

async function cleanupOrphanedTempFiles(): Promise<void> {
  const cachePath = getWindowStateCachePath()
  const dir = dirname(cachePath)
  const baseName = basename(cachePath)

  try {
    const files = await readdir(dir)
    const orphaned = files.filter((f) => f.startsWith(`${baseName}.`) && f !== baseName)
    await Promise.all(orphaned.map((f) => unlink(`${dir}/${f}`).catch(() => {})))
  } catch {
    // Best-effort cleanup
  }
}

function fitToDisplay(window: BrowserWindow): void {
  const bounds = window.getBounds()
  const display = screen.getDisplayMatching(bounds)
  const { workAreaSize } = display

  const clampedWidth = Math.min(bounds.width, workAreaSize.width)
  const clampedHeight = Math.min(bounds.height, workAreaSize.height)

  if (clampedWidth !== bounds.width || clampedHeight !== bounds.height) {
    window.setSize(clampedWidth, clampedHeight)
  }
}

// ============================================================================
// STORAGE ACCESSORS
// ============================================================================

export const windowStateStorage = {
  /** Read saved window size */
  async read(): Promise<{ width: number; height: number }> {
    cleanupOrphanedTempFiles() // Fire and forget

    try {
      const content = await readFile(getWindowStateCachePath(), 'utf-8')
      return WindowStateSchema.parse(JSON.parse(content))
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return DEFAULT_SIZE
      }
      warn('window', 'Failed to restore window size, using default')
      return DEFAULT_SIZE
    }
  },

  /** Write window size to cache */
  async write(size: { width: number; height: number }): Promise<void> {
    const filePath = getWindowStateCachePath()
    await mkdir(dirname(filePath), { recursive: true })
    await writeFileAtomic(filePath, JSON.stringify(size), { encoding: 'utf-8' })
  },

  /** Track window resize and persist on change */
  track(window: BrowserWindow): void {
    fitToDisplay(window)

    let debounceTimer: NodeJS.Timeout | null = null

    const saveSize = () => {
      const [width, height] = window.getSize()
      this.write({ width, height }).catch((err) => {
        error('window', 'Failed to save window size', err)
      })
    }

    window.on('resize', () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(saveSize, 500)
    })

    window.on('close', () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      saveSize()
    })
  },
}
