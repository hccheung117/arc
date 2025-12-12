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

import {app, BrowserWindow, ipcMain, Menu} from 'electron';
import {buildAppMenu} from './menu';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import {registerArcHandlers} from './ipc';
import {handleProfileFileOpen} from './lib/profiles';
import {initModels} from './lib/models';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
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
  });

  const appMenu = buildAppMenu();
  Menu.setApplicationMenu(appMenu);

  // Load renderer: dev server in development, file in production
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  return mainWindow;
};

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  createWindow();
  registerArcHandlers(ipcMain);
  initModels();
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle .arc file drops on dock icon (macOS) and file associations
app.on('open-file', async (event, filePath) => {
  event.preventDefault();
  await handleProfileFileOpen(filePath);
});
