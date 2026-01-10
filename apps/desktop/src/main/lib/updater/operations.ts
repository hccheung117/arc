/**
 * Auto-Update Operations
 *
 * Integrates with update.electronjs.org for open-source auto-updates.
 * Windows-only (macOS requires code signing).
 */

import { app } from 'electron'
import { updateElectronApp, UpdateSourceType } from 'update-electron-app'
import { info, error } from '@main/foundation/logger'

const GITHUB_REPO = 'hccheung117/arc'

/**
 * Initialize auto-updates.
 * Only runs in production on Windows.
 */
export function initAutoUpdate(intervalMinutes?: number): void {
  if (!app.isPackaged) {
    info('updater', 'Skipping auto-update in development')
    return
  }

  if (process.platform !== 'win32') {
    info('updater', `Auto-update disabled on ${process.platform}`)
    return
  }

  const interval = intervalMinutes ? `${intervalMinutes} minutes` : '1 hour'

  try {
    updateElectronApp({
      updateSource: {
        type: UpdateSourceType.ElectronPublicUpdateService,
        repo: GITHUB_REPO,
      },
      updateInterval: interval,
      notifyUser: true,
      logger: {
        log: (msg: string) => info('updater', msg),
        info: (msg: string) => info('updater', msg),
        warn: (msg: string) => info('updater', `[warn] ${msg}`),
        error: (msg: string) => error('updater', msg),
      },
    })
    info('updater', 'Auto-update initialized')
  } catch (err) {
    error('updater', 'Failed to initialize', err as Error)
  }
}
