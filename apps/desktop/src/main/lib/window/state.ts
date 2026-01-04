/**
 * Window State Persistence
 *
 * Persists window size to a cache file and restores it on app launch.
 * Position is left to the OS. Size is clamped to the window's actual display.
 */

import { screen, type BrowserWindow } from 'electron'
import { readFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import writeFileAtomic from 'write-file-atomic'
import { z } from 'zod'
import { getWindowStateCachePath } from '@main/foundation/paths'
import { warn, error } from '@main/foundation/logger'

const WindowStateSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
})

const DEFAULT_SIZE = { width: 800, height: 600 }
export const MIN_SIZE = { width: 700, height: 550 }

/**
 * Reads saved window size.
 * Returns default size if no saved state or on error.
 */
export async function readWindowSize(): Promise<{ width: number; height: number }> {
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
}

/**
 * Saves window size to cache file.
 */
export async function writeWindowSize(size: { width: number; height: number }): Promise<void> {
  const filePath = getWindowStateCachePath()
  await mkdir(dirname(filePath), { recursive: true })
  await writeFileAtomic(filePath, JSON.stringify(size), { encoding: 'utf-8' })
}

/**
 * Resizes window if it overflows its current display's work area.
 */
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

/**
 * Attaches resize tracking to a window.
 * Fits to display on init, saves size on resize (debounced) and on close.
 */
export function trackWindowSize(window: BrowserWindow): void {
  fitToDisplay(window)

  let debounceTimer: NodeJS.Timeout | null = null

  const saveSize = () => {
    const [width, height] = window.getSize()
    writeWindowSize({ width, height }).catch((err) => {
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
}
