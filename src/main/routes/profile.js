import { dialog, shell } from 'electron'
import { register, getMainWindow } from '../router.js'
import { resolve } from '../arcfs.js'
import { exportProfile, importProfile, getActiveProfile, activateProfile } from '../services/profile.js'

register('profile:export', async () => {
  const name = await getActiveProfile()
  if (!name) return false
  const { canceled, filePath } = await dialog.showSaveDialog(getMainWindow(), {
    defaultPath: `${name}.arc`,
    filters: [{ name: 'Arc Profile', extensions: ['arc'] }],
  })
  if (canceled || !filePath) return false
  exportProfile(resolve('profiles', name), filePath)
  return true
})

register('profile:reveal', async () => {
  const name = await getActiveProfile()
  if (!name) return false
  shell.openPath(resolve('profiles', name))
  return true
})

register('profile:import', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(getMainWindow(), {
    filters: [{ name: 'Arc Profile', extensions: ['arc'] }],
    properties: ['openFile'],
  })
  if (canceled || !filePaths.length) return false
  const name = await importProfile(filePaths[0], resolve('profiles'))
  await activateProfile(name)
  getMainWindow().webContents.reload()
  return true
})
