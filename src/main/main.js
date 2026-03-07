import { app, BrowserWindow, Menu } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { initIpc, setMainWindow } from './router.js';
import { resolve } from './arcfs.js';
import { getState, setState } from './services/state.js';
import { pushSessions } from './routes/session.js';
import { pushPrompts } from './routes/prompts.js';
import { pushModels, refreshModels } from './routes/models.js';
import { pushProviders } from './routes/providers.js';
import { pushState } from './routes/state.js';
import { pushSettings } from './routes/settings.js';
import './routes/message.js';
import './routes/assist.js';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const stateFile = resolve('state.json')

const createWindow = async () => {
  const { windowBounds } = await getState(stateFile)

  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    ...windowBounds,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  setMainWindow(mainWindow);

  mainWindow.on('close', async () => {
    const { width, height } = mainWindow.getBounds()
    await setState(stateFile, { windowBounds: { width, height } })
  })

  mainWindow.webContents.on('context-menu', (_event, params) => {
    if (!params.isEditable) return

    const spellItems = []
    if (params.misspelledWord) {
      for (const suggestion of params.dictionarySuggestions) {
        spellItems.push({
          label: suggestion,
          click: () => mainWindow.webContents.replaceMisspelling(suggestion),
        })
      }
      if (spellItems.length) spellItems.push({ type: 'separator' })
    }

    const editItems = Menu.buildFromTemplate([{ role: 'editMenu' }]).items[0].submenu.items
    Menu.buildFromTemplate([...spellItems, ...editItems]).popup({ frame: params.frame })
  });

  mainWindow.webContents.on('did-finish-load', async () => {
    await pushSessions();
    await pushPrompts();
    await pushModels();
    await pushProviders();
    await pushState();
    await pushSettings();
    refreshModels();
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  initIpc();
  createWindow();

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
