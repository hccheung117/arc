import { app } from 'electron'
import { updateElectronApp, UpdateSourceType } from 'update-electron-app'
import type loggerAdapter from './logger'

type Logger = ReturnType<typeof loggerAdapter.factory>

const GITHUB_REPO = 'hccheung117/arc'

export const createUpdater = (logger: Logger) => ({
  init: initAutoUpdate(logger),
})

const initAutoUpdate = (logger: Logger) => (intervalMinutes?: number): void => {
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
