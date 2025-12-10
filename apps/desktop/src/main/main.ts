import {app, BrowserWindow, ipcMain, Menu} from 'electron';
import {buildAppMenu} from './menu';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import started from 'electron-squirrel-startup';
import {emitModelsEvent, emitProfilesEvent, registerArcHandlers} from './ipc';
import {activateProfile, installProfile} from './lib/profiles';
import {fetchAllModels} from './lib/models';
import {logger} from './lib/logger';

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

  if (process.platform !== 'darwin') {
    mainWindow.setMenuBarVisibility(false);
  }

  return mainWindow;
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  createWindow();
  registerArcHandlers(ipcMain);

  // Background model fetch on startup
  fetchAllModels()
    .then((updated) => {
      if (updated) emitModelsEvent({ type: 'updated' });
    })
    .catch((err) => logger.error('models', 'Startup fetch failed', err as Error));
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

  logger.info('profiles', `Dock drop: ${filePath}`);

  try {
    const content = await readFile(filePath, 'utf-8');
    const result = await installProfile(content);
    emitProfilesEvent({ type: 'installed', profile: result });

    // Auto-activate the installed profile
    await activateProfile(result.id);
    emitProfilesEvent({ type: 'activated', profileId: result.id });

    // Trigger background model fetch after activation
    fetchAllModels()
      .then((updated) => {
        if (updated) emitModelsEvent({ type: 'updated' });
      })
      .catch((err) => logger.error('models', 'Background fetch failed', err as Error));
  } catch (error) {
    logger.error('profiles', 'Dock drop failed', error as Error);
  }
});
