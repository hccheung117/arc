import {app, Menu} from 'electron';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;

export const buildAppMenu = () => {
  const viewSubmenu: Electron.MenuItemConstructorOptions[] = [
    { role: 'togglefullscreen' },
  ];

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    viewSubmenu.push(
      { type: 'separator' },
      {
        role: 'toggleDevTools',
        accelerator: process.platform === 'darwin' ? 'Command+Alt+I' : 'Control+Shift+I',
      },
    );
  }

  if (process.platform === 'darwin') {
    return Menu.buildFromTemplate([
      {
        label: app.name,
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' },
        ],
      },
      {
        label: 'File',
        submenu: [{ role: 'close' }],
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' },
        ],
      },
      {
        label: 'View',
        submenu: viewSubmenu,
      },
      {
        label: 'Window',
        submenu: [
          { role: 'minimize' },
          { role: 'zoom' },
          { role: 'close' },
        ],
      },
    ]);
  }

  return Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        { role: 'close' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: viewSubmenu,
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' },
      ],
    },
  ]);
};
