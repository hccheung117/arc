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
 * extract it to the appropriate layer (foundation/, lib/, or app/).
 */

import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  type BrowserWindowConstructorOptions,
} from 'electron'
import path from 'node:path'
import started from 'electron-squirrel-startup'
import { buildAppMenu } from './menu'
import { registerDataHandlers } from '@main/app/data'
import { registerAIHandlers } from '@main/app/ai'
import { registerSystemHandlers } from '@main/app/system'
import { initApp, handleProfileFileOpen } from '@main/app/lifecycle'
import { readWindowSize, trackWindowSize, MIN_SIZE } from '@main/lib/window/state'
import { setupEditableContextMenu } from '@main/lib/ui'

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit()
}

// ─────────────────────────────────────────────────────────────────
// Config builders (pure)
// ─────────────────────────────────────────────────────────────────

const buildWindowConfig = (size: { width: number; height: number }): BrowserWindowConstructorOptions => ({
  ...size,
  minWidth: MIN_SIZE.width,
  minHeight: MIN_SIZE.height,
  autoHideMenuBar: process.platform !== 'darwin',
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    spellcheck: true,
  },
})

// ─────────────────────────────────────────────────────────────────
// Window initializers (side effects)
// ─────────────────────────────────────────────────────────────────

const loadRenderer = (window: BrowserWindow): void => {
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
  } else {
    window.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`))
  }
}

// ─────────────────────────────────────────────────────────────────
// Composition
// ─────────────────────────────────────────────────────────────────

const createWindow = (size: { width: number; height: number }) => {
  const window = new BrowserWindow(buildWindowConfig(size))
  trackWindowSize(window)
  setupEditableContextMenu(window)
  loadRenderer(window)
  return window
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
app.on('ready', async () => {
  Menu.setApplicationMenu(buildAppMenu())

  const size = await readWindowSize()
  createWindow(size)
  registerDataHandlers(ipcMain)
  registerAIHandlers(ipcMain)
  registerSystemHandlers(ipcMain)
  initApp()
})

app.on('activate', async () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    const size = await readWindowSize()
    createWindow(size)
  }
})

// Handle .arc file drops on dock icon (macOS) and file associations
app.on('open-file', async (event, filePath) => {
  event.preventDefault()
  await handleProfileFileOpen(filePath)
})
