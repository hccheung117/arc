import { app, BrowserWindow, Menu } from 'electron';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 400,
    minHeight: 600,
    titleBarStyle: 'default',
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // In development, load from Next.js dev server
  // In production, load from built Next.js app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    // TODO: Load built Next.js app
    mainWindow.loadURL('http://localhost:3000');
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createMenu() {
  // @ts-expect-error - Complex menu template with dynamic platform-specific items
  const template = [
    ...(process.platform === 'darwin'
      ? [
          {
            label: app.name,
            submenu: [
              /** @type {import('electron').MenuItemConstructorOptions} */
              ({
                label: 'About Arc',
                role: /** @type {const} */ ('about'),
              }),
              /** @type {import('electron').MenuItemConstructorOptions} */
              ({ type: /** @type {const} */ ('separator') }),
              {
                label: 'Quit',
                accelerator: 'CmdOrCtrl+Q',
                click: () => {
                  app.quit();
                },
              },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        ...(process.platform !== 'darwin'
          ? [
              {
                label: 'About',
                click: () => {
                  // Placeholder for About dialog
                  console.log('About Arc');
                },
              },
              /** @type {import('electron').MenuItemConstructorOptions} */
              ({ type: /** @type {const} */ ('separator') }),
            ]
          : []),
        {
          label: 'Quit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          },
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        /** @type {import('electron').MenuItemConstructorOptions} */
        ({ role: /** @type {const} */ ('undo') }),
        /** @type {import('electron').MenuItemConstructorOptions} */
        ({ role: /** @type {const} */ ('redo') }),
        /** @type {import('electron').MenuItemConstructorOptions} */
        ({ type: /** @type {const} */ ('separator') }),
        /** @type {import('electron').MenuItemConstructorOptions} */
        ({ role: /** @type {const} */ ('cut') }),
        /** @type {import('electron').MenuItemConstructorOptions} */
        ({ role: /** @type {const} */ ('copy') }),
        /** @type {import('electron').MenuItemConstructorOptions} */
        ({ role: /** @type {const} */ ('paste') }),
        /** @type {import('electron').MenuItemConstructorOptions} */
        ({ role: /** @type {const} */ ('selectAll') }),
      ],
    },
    {
      label: 'View',
      submenu: [
        /** @type {import('electron').MenuItemConstructorOptions} */
        ({ role: /** @type {const} */ ('reload') }),
        /** @type {import('electron').MenuItemConstructorOptions} */
        ({ role: /** @type {const} */ ('forceReload') }),
        /** @type {import('electron').MenuItemConstructorOptions} */
        ({ role: /** @type {const} */ ('toggleDevTools') }),
        /** @type {import('electron').MenuItemConstructorOptions} */
        ({ type: /** @type {const} */ ('separator') }),
        /** @type {import('electron').MenuItemConstructorOptions} */
        ({ role: /** @type {const} */ ('resetZoom') }),
        /** @type {import('electron').MenuItemConstructorOptions} */
        ({ role: /** @type {const} */ ('zoomIn') }),
        /** @type {import('electron').MenuItemConstructorOptions} */
        ({ role: /** @type {const} */ ('zoomOut') }),
        /** @type {import('electron').MenuItemConstructorOptions} */
        ({ type: /** @type {const} */ ('separator') }),
        /** @type {import('electron').MenuItemConstructorOptions} */
        ({ role: /** @type {const} */ ('togglefullscreen') }),
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  createMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
