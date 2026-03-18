import { app, autoUpdater } from 'electron'
import { updateElectronApp, UpdateSourceType } from 'update-electron-app'

export const checkForUpdates = () => {
  autoUpdater.checkForUpdates()
}

export const initUpdater = () => {
  if (!app.isPackaged) return

  updateElectronApp({
    updateSource: {
      type: UpdateSourceType.ElectronPublicUpdateService,
      repo: 'hccheung117/arc',
    },
    notifyUser: true,
  })
}
