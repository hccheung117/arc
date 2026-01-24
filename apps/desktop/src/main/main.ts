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
import { registerProfileHandlers } from '@main/app/data'
import { registerAIHandlers } from '@main/app/ai'
import { registerSystemHandlers } from '@main/app/system'
import { registerPersonaHandlers } from '@main/app/personas'
import { initApp, handleProfileFileOpen } from '@main/app/lifecycle'
import { createKernel } from '@main/kernel/boot'
import uiModule from '@main/modules/ui/mod'
import uiJsonFileAdapter from '@main/modules/ui/json-file'
import messagesModule from '@main/modules/messages/mod'
import messagesJsonLogAdapter from '@main/modules/messages/json-log'
import messagesJsonFileAdapter from '@main/modules/messages/json-file'
import messagesLoggerAdapter from '@main/modules/messages/logger'
import threadsModule from '@main/modules/threads/mod'
import threadsJsonFileAdapter from '@main/modules/threads/json-file'
import threadsJsonLogAdapter from '@main/modules/threads/json-log'
import threadsLoggerAdapter from '@main/modules/threads/logger'
import updaterModule from '@main/modules/updater/mod'
import updaterLoggerAdapter from '@main/modules/updater/logger'
import { createJsonFile } from '@main/foundation/json-file'
import { createLogger } from '@main/foundation/logger'
import { createJsonLog } from '@main/foundation/json-log'
import { createArchive } from '@main/foundation/archive'
import { createGlob } from '@main/foundation/glob'
import { getDataDir } from '@main/kernel/paths.tmp'

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit()
}

// ─────────────────────────────────────────────────────────────────
// Kernel initialization
// ─────────────────────────────────────────────────────────────────

const dataDir = getDataDir()
const kernel = createKernel({
  ipcMain,
  dataDir,
  foundation: {
    jsonFile: createJsonFile,
    jsonLog: createJsonLog,
    archive: createArchive,
    glob: createGlob(),
    logger: createLogger('kernel'),
  },
})

// Register modules with adapters
kernel.register('ui', uiModule, {
  jsonFile: uiJsonFileAdapter,
})

kernel.register('messages', messagesModule, {
  jsonLog: messagesJsonLogAdapter,
  jsonFile: messagesJsonFileAdapter,
  logger: messagesLoggerAdapter,
})

kernel.register('threads', threadsModule, {
  jsonFile: threadsJsonFileAdapter,
  jsonLog: threadsJsonLogAdapter,
  logger: threadsLoggerAdapter,
})

kernel.register('updater', updaterModule, {
  logger: updaterLoggerAdapter,
})

// Boot kernel (instantiates modules, registers IPC)
kernel.boot()

// Get UI module API for direct usage
type UiApi = {
  getMinSize: () => { width: number; height: number }
  readWindowState: () => Promise<{ width: number; height: number }>
  trackWindowState: (window: BrowserWindow) => void
  setupEditableContextMenu: (window: BrowserWindow) => void
}
const ui = kernel.getModule<UiApi>('ui')!
const { getMinSize, readWindowState, trackWindowState, setupEditableContextMenu } = ui
const minSize = getMinSize()

type UpdaterApi = { init: (intervalMinutes?: number) => void }
const updater = kernel.getModule<UpdaterApi>('updater')!

// ─────────────────────────────────────────────────────────────────
// Config builders (pure)
// ─────────────────────────────────────────────────────────────────

const buildWindowConfig = (size: { width: number; height: number }): BrowserWindowConstructorOptions => ({
  ...size,
  minWidth: minSize.width,
  minHeight: minSize.height,
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
  trackWindowState(window)
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

  const size = await readWindowState()
  createWindow(size)
  registerProfileHandlers(ipcMain)
  // Messages + threads + UI handlers auto-registered via kernel.boot()
  registerAIHandlers(ipcMain)
  registerSystemHandlers(ipcMain)
  registerPersonaHandlers(ipcMain)
  initApp(updater)
})

app.on('activate', async () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    const size = await readWindowState()
    createWindow(size)
  }
})

// Handle .arc file drops on dock icon (macOS) and file associations
app.on('open-file', async (event, filePath) => {
  event.preventDefault()
  await handleProfileFileOpen(filePath)
})
