/**
 * Main Process Entry Point
 *
 * This file is pure orchestration—no business logic belongs here.
 * All handlers should be single function calls delegating to lib/ modules.
 *
 * What belongs here:
 * - Window creation and lifecycle
 * - App event handlers (ready, activate, window-all-closed)
 * - Handler registration (single function calls)
 *
 * What does NOT belong here:
 * - File I/O, validation, or data processing
 * - Multi-step workflows or conditional logic
 * - Direct IPC handler implementations
 *
 * If you're writing more than a one-liner in an event handler,
 * extract it to a lib/ module first.
 */

import { app, BrowserWindow, ipcMain, Menu } from 'electron'
import path from 'node:path'
import * as fs from 'fs/promises'
import started from 'electron-squirrel-startup'
import { buildAppMenu } from './menu'
import { registerDataHandlers } from '@main/app/data'
import { registerAIHandlers } from '@main/app/ai'
import { registerSystemHandlers } from '@main/app/system'
import { installProfile, activateProfile, getActiveProfile, emitProfilesEvent } from './lib/profile/operations'
import { fetchModelsForProfile, emitModelsEvent } from './lib/models/operations'
import { info, error } from '@main/foundation/logger'

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit()
}

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 700,
    minHeight: 550,
    autoHideMenuBar: process.platform !== 'darwin',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  const appMenu = buildAppMenu()
  Menu.setApplicationMenu(appMenu)

  // Load renderer: dev server in development, file in production
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    )
  }

  return mainWindow
}

/**
 * Initialize models on app startup.
 * Orchestrates: profile → models
 */
async function initModels(): Promise<void> {
  try {
    const profile = await getActiveProfile()
    const updated = await fetchModelsForProfile(profile)
    if (updated) emitModelsEvent({ type: 'updated' })
  } catch (err) {
    error('models', 'Startup fetch failed', err as Error)
  }
}

/**
 * Handle .arc file opened via dock drop or file association.
 * Orchestrates: install → activate → fetch models
 */
async function handleProfileFileOpen(filePath: string): Promise<void> {
  if (path.extname(filePath).toLowerCase() !== '.arc') {
    return
  }

  info('profiles', `File open: ${filePath}`)

  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const result = await installProfile(content)
    emitProfilesEvent({ type: 'installed', profile: result })

    await activateProfile(result.id)
    emitProfilesEvent({ type: 'activated', profileId: result.id })

    // Background model fetch after activation
    const profile = await getActiveProfile()
    fetchModelsForProfile(profile)
      .then((updated) => {
        if (updated) emitModelsEvent({ type: 'updated' })
      })
      .catch((err) => error('models', 'Background fetch failed', err as Error))
  } catch (err) {
    error('profiles', 'File open failed', err as Error)
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  createWindow()
  registerDataHandlers(ipcMain)
  registerAIHandlers(ipcMain)
  registerSystemHandlers(ipcMain)
  initModels()
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// Handle .arc file drops on dock icon (macOS) and file associations
app.on('open-file', async (event, filePath) => {
  event.preventDefault()
  await handleProfileFileOpen(filePath)
})
