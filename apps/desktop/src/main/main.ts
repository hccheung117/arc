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
 * extract it to the appropriate layer (foundation/, lib/, or modules/).
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
import { createKernel } from '@main/kernel/boot'
import { createJsonFile } from '@main/foundation/json-file'
import { createLogger } from '@main/foundation/logger'
import { createJsonLog } from '@main/foundation/json-log'
import { createBinaryFile } from '@main/foundation/binary-file'
import { createMarkdownFile } from '@main/foundation/markdown-file'
import { createArchive } from '@main/foundation/archive'
import { createGlob } from '@main/foundation/glob'
import { createHttp } from '@main/foundation/http'

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit()
}

// ─────────────────────────────────────────────────────────────────
// Kernel initialization
// ─────────────────────────────────────────────────────────────────

const dataDir = path.join(app.getPath('userData'), 'arcfs')
const kernel = createKernel({
  ipcMain,
  dataDir,
  foundation: {
    jsonFile: createJsonFile,
    jsonLog: createJsonLog,
    binaryFile: createBinaryFile,
    markdownFile: createMarkdownFile,
    archive: createArchive,
    glob: createGlob,
    logger: createLogger('kernel'),
    http: createHttp(),
  },
})

// Boot kernel (discovers modules, resolves dependencies, instantiates, registers IPC)
kernel.boot()

// Get module APIs for direct usage in main.ts
type UiApi = {
  getMinSize: () => { width: number; height: number }
  buildAppMenu: () => Electron.Menu
  readWindowState: () => Promise<{ width: number; height: number }>
  trackWindowState: (window: BrowserWindow) => void
  setupEditableContextMenu: (window: BrowserWindow) => void
}
const ui = kernel.getModule<UiApi>('ui')!
const { getMinSize, buildAppMenu, readWindowState, trackWindowState, setupEditableContextMenu } = ui
const minSize = getMinSize()

type UpdaterApi = { init: (intervalMinutes?: number) => void }
const updater = kernel.getModule<UpdaterApi>('updater')!

type ProfilesApi = {
  install: (input: { filePath: string }) => Promise<unknown>
  getActive: () => Promise<{ updateInterval?: number } | null>
}
const profilesApi = kernel.getModule<ProfilesApi>('profiles')!

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

  // Initialize updater with profile's update interval
  const activeProfile = await profilesApi.getActive() as { updateInterval?: number } | null
  updater.init(activeProfile?.updateInterval)
})

app.on('activate', async () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    const size = await readWindowState()
    createWindow(size)
  }
})

app.on('open-file', async (event, filePath) => {
  event.preventDefault()
  if (filePath.toLowerCase().endsWith('.arc')) {
    try {
      await profilesApi.install({ filePath })
    } catch {
      // Error logged by module
    }
  }
})
