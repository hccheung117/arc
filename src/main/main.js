import { app, BrowserWindow, Menu, MenuItem, protocol, net, shell } from 'electron';
import './init.js';
import fixPath from 'fix-path';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import started from 'electron-squirrel-startup';
import { initIpc, setMainWindow, getMainWindow, dispatch } from './router.js';
import { pushAll } from './channel.js';
import { resolve, fromUrl, builtinBase, builtinProfilesBase } from './arcfs.js';
import { getState, setState } from './services/state.js';
import { refreshModels } from './routes/models.js';
import { listProfiles, getActiveProfile, seedBuiltinProfiles } from './services/profile.js';
import './routes/session.js';
import './routes/prompts.js';
import './routes/providers.js';
import './routes/state.js';
import './routes/settings.js';
import './routes/message.js';
import './routes/assist.js';
import './routes/profile.js';
import './routes/skills.js'
import './routes/agents.js'
import './routes/popout.js';
import { initUpdater, checkForUpdates } from './updater.js';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

protocol.registerSchemesAsPrivileged([
  { scheme: 'arcfs', privileges: { standard: true, secure: true, supportFetchAPI: true } },
])

const stateFile = resolve('state.json')

const buildProfileSubmenu = async () => {
  const [profiles, active] = await Promise.all([listProfiles(), getActiveProfile()])
  if (!profiles.length) return [{ label: 'No Profiles', enabled: false }]
  return profiles.map(name => ({
    label: name,
    type: 'radio',
    checked: name === active,
    click: () => dispatch('profile:switch', name),
  }))
}

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
    await pushAll();
    refreshModels(); // fire-and-forget: UI shows cached models immediately, fresh fetch updates in background
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
app.whenReady().then(async () => {
  fixPath()
  fs.rm(resolve('tmp'), { recursive: true, force: true }).catch(() => {})

  const arcfsRoot = resolve()
  const builtinRoot = builtinBase()
  protocol.handle('arcfs', (request) => {
    const filePath = fromUrl(request.url)
    if (!filePath.startsWith(arcfsRoot) && !filePath.startsWith(builtinRoot))
      return new Response('Forbidden', { status: 403 })
    return net.fetch(pathToFileURL(filePath).toString())
  })

  await seedBuiltinProfiles(builtinProfilesBase(), resolve('profiles'))

  // Always only modify built menu instances instead of duplicating role submenus
  const menu = Menu.buildFromTemplate([
    { role: 'appMenu' },
    { label: 'File', submenu: [
      { label: 'Import Profile...', click: () => dispatch('profile:import') },
      { label: 'Export Profile...', click: () => dispatch('profile:export') },
      { label: 'Open Profile Folder', click: () => dispatch('profile:reveal') },
      { label: 'Open App Folder', click: () => dispatch('profile:reveal', '@app') },
      { type: 'separator' },
      { label: 'Switch Profile', submenu: await buildProfileSubmenu() },
      { type: 'separator' },
      { role: 'close' },
    ]},
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    { role: 'help', submenu: [
      { label: 'Source Code', click: () => shell.openExternal('https://github.com/hccheung117/arc/') },
    ]},
  ])

  const appMenuSub = menu.items.find(i => i.role === 'appmenu').submenu
  appMenuSub.insert(1, new MenuItem({ label: 'Check for Updates...', click: checkForUpdates, enabled: app.isPackaged }))

  const devRoles = new Set(['reload', 'forcereload', 'toggledevtools'])
  for (const item of menu.items.find(i => i.role === 'viewmenu').submenu.items) {
    if (devRoles.has(item.role)) { item.visible = false; item.enabled = false }
  }

  Menu.setApplicationMenu(menu)

  initIpc();
  createWindow();
  initUpdater();

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (!getMainWindow() || getMainWindow().isDestroyed()) {
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
