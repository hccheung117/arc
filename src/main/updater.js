import { app } from 'electron'
import { updateElectronApp, UpdateSourceType } from 'update-electron-app'

export const initUpdater = () => {
  if (!app.isPackaged || process.platform !== 'win32') return

  updateElectronApp({
    updateSource: {
      type: UpdateSourceType.ElectronPublicUpdateService,
      repo: 'hccheung117/arc',
    },
    notifyUser: true,
  })
}
