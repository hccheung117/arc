import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import started from 'electron-squirrel-startup';
import { registerArcHandlers, emitImportEvent } from './ipc';
import { validateArcFile, importArcFile } from './lib/arc-import';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 700,
    minHeight: 550,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  registerArcHandlers(ipcMain);
  createWindow();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
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

  // Only process .arc files
  if (path.extname(filePath).toLowerCase() !== '.arc') {
    return;
  }

  console.log(`[arc:import] Dock drop: ${filePath}`);

  try {
    const content = await readFile(filePath, 'utf-8');
    const validation = validateArcFile(content);

    if (!validation.valid || !validation.data) {
      emitImportEvent({
        type: 'error',
        error: validation.error || 'Invalid .arc file',
      });
      return;
    }

    const result = await importArcFile(validation.data);
    emitImportEvent({ type: 'success', result });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Import failed';
    emitImportEvent({ type: 'error', error: errorMsg });
  }
});
