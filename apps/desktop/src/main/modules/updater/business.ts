/**
 * Updater Business Logic
 *
 * Integrates with update.electronjs.org for open-source auto-updates.
 * Windows-only (macOS requires code signing).
 */

import { app } from 'electron'
import { updateElectronApp, UpdateSourceType } from 'update-electron-app'

const GITHUB_REPO = 'hccheung117/arc'

/**
 * Logger interface expected by update-electron-app (ILogger).
 */
interface UpdaterLogger {
  log: (message: string) => void
  info: (message: string) => void
  warn: (message: string) => void
  error: (message: string) => void
}

/**
 * Initialize auto-updates.
 * Only runs in production on Windows.
 */
export const initAutoUpdate =
  (logger: UpdaterLogger) =>
  (intervalMinutes?: number): void => {
    if (!app.isPackaged) {
      logger.info('Skipping auto-update in development')
      return
    }

    if (process.platform !== 'win32') {
      logger.info(`Auto-update disabled on ${process.platform}`)
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
        logger,
      })
      logger.info('Auto-update initialized')
    } catch (err) {
      logger.error(`Failed to initialize: ${(err as Error).message}`)
    }
  }

/**
 * Create the updater API with injected logger capability.
 */
export const createUpdater = (logger: UpdaterLogger) => ({
  init: initAutoUpdate(logger),
})
