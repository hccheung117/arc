import { app, BrowserWindow, Menu, ipcMain, dialog } from 'electron';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * @type {BrowserWindow | null}
 */
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
      label: 'Help',
      submenu: [
        {
          label: 'Check for Updates...',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('show-update-dialog');
            }
          },
        },
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

// ---------------------------------------------------------------------------
// IPC Handlers for File System Operations
// ---------------------------------------------------------------------------

/**
 * Sanitize a file name to prevent directory traversal
 * @param {string} fileName
 * @returns {string}
 */
function sanitizeFileName(fileName) {
  // Remove any path separators and parent directory references
  return fileName.replace(/[/\\]/g, '_').replace(/\.\./g, '_');
}

/**
 * Get the attachments directory path for a specific chat
 * @param {string} chatId
 * @returns {string}
 */
function getAttachmentsDir(chatId) {
  const userDataPath = app.getPath('userData');
  const sanitizedChatId = sanitizeFileName(chatId);
  return path.join(userDataPath, 'attachments', sanitizedChatId);
}

/**
 * Ensure a directory exists, creating it if necessary
 * @param {string} dirPath
 * @returns {Promise<void>}
 */
async function ensureDir(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code !== 'EEXIST') {
      throw error;
    }
  }
}

/**
 * Handle file picker dialog for images
 */
ipcMain.handle('dialog:openFile', async () => {
  if (!mainWindow) {
    return [];
  }

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      {
        name: 'Images',
        extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'],
      },
    ],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return [];
  }

  // Read files and convert to base64
  const files = [];
  for (const filePath of result.filePaths) {
    try {
      const data = await fs.readFile(filePath);
      const base64 = data.toString('base64');
      const stat = await fs.stat(filePath);
      const fileName = path.basename(filePath);
      const ext = path.extname(fileName).toLowerCase();

      // Determine MIME type
      /** @type {Record<string, string>} */
      const mimeTypes = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.bmp': 'image/bmp',
        '.svg': 'image/svg+xml',
      };
      const mimeType = mimeTypes[ext] || 'application/octet-stream';

      files.push({
        name: fileName,
        mimeType,
        size: stat.size,
        data: `data:${mimeType};base64,${base64}`,
      });
    } catch (error) {
      console.error(`Failed to read file ${filePath}:`, error);
    }
  }

  return files;
});

/**
 * Save an attachment to the file system
 */
ipcMain.handle(
  'fs:saveAttachment',
  async (event, attachmentId, chatId, fileName, mimeType, data) => {
    // Validate inputs
    if (!attachmentId || !chatId || !fileName || !data) {
      throw new Error('Invalid attachment parameters');
    }

    // Sanitize IDs and file name
    const sanitizedAttachmentId = sanitizeFileName(attachmentId);
    const sanitizedFileName = sanitizeFileName(fileName);

    // Determine file extension from MIME type or original file name
    const ext = path.extname(sanitizedFileName) || '.bin';
    const finalFileName = `${sanitizedAttachmentId}${ext}`;

    // Get attachments directory for this chat
    const attachmentsDir = getAttachmentsDir(chatId);
    await ensureDir(attachmentsDir);

    // Full file path
    const filePath = path.join(attachmentsDir, finalFileName);

    // Convert base64 data URL to buffer
    /** @type {Buffer} */
    let buffer;
    if (typeof data === 'string') {
      // Remove data URL prefix if present
      const base64Data = data.includes(',') ? data.split(',')[1] : data;
      if (!base64Data) {
        throw new Error('Invalid base64 data');
      }
      buffer = Buffer.from(base64Data, 'base64');
    } else {
      buffer = Buffer.from(data);
    }

    // Write file
    await fs.writeFile(filePath, buffer);

    // Return relative storage path
    const sanitizedChatId = sanitizeFileName(chatId);
    return path.join('attachments', sanitizedChatId, finalFileName);
  }
);

/**
 * Load an attachment from the file system
 */
ipcMain.handle('fs:loadAttachment', async (event, storagePath) => {
  // Validate input
  if (!storagePath) {
    throw new Error('Invalid storage path');
  }

  // Sanitize path to prevent directory traversal
  const normalizedPath = path.normalize(storagePath);
  if (normalizedPath.includes('..')) {
    throw new Error('Invalid storage path: contains parent directory reference');
  }

  // Full file path
  const userDataPath = app.getPath('userData');
  const filePath = path.join(userDataPath, normalizedPath);

  // Check if file exists and is within userData directory
  const realPath = await fs.realpath(filePath).catch(() => null);
  if (!realPath || !realPath.startsWith(userDataPath)) {
    throw new Error('File not found or access denied');
  }

  // Read file and convert to base64
  const data = await fs.readFile(filePath);
  return data.toString('base64');
});

/**
 * Delete an attachment from the file system
 */
ipcMain.handle('fs:deleteAttachment', async (event, storagePath) => {
  // Validate input
  if (!storagePath) {
    return; // Silently ignore
  }

  // Sanitize path to prevent directory traversal
  const normalizedPath = path.normalize(storagePath);
  if (normalizedPath.includes('..')) {
    throw new Error('Invalid storage path: contains parent directory reference');
  }

  // Full file path
  const userDataPath = app.getPath('userData');
  const filePath = path.join(userDataPath, normalizedPath);

  // Check if file exists and is within userData directory
  const realPath = await fs.realpath(filePath).catch(() => null);
  if (!realPath || !realPath.startsWith(userDataPath)) {
    return; // File doesn't exist or is outside userData
  }

  // Delete file
  await fs.unlink(filePath).catch(() => {
    // Ignore errors (file might already be deleted)
  });
});

/**
 * Delete all attachments for a chat
 */
ipcMain.handle('fs:deleteAttachmentsForChat', async (event, chatId) => {
  // Validate input
  if (!chatId) {
    return;
  }

  // Get attachments directory for this chat
  const attachmentsDir = getAttachmentsDir(chatId);

  // Delete directory and all contents
  await fs.rm(attachmentsDir, { recursive: true, force: true }).catch(() => {
    // Ignore errors (directory might not exist)
  });
});

/**
 * Get app version
 */
ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});

/**
 * Get user data path
 */
ipcMain.handle('app:getUserDataPath', () => {
  return app.getPath('userData');
});

/**
 * Check for updates from GitHub releases
 */
ipcMain.handle('updates:check', async () => {
  try {
    // TODO: Replace with your actual GitHub repository
    const owner = 'your-org';
    const repo = 'arc';
    const url = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Arc-Desktop-App',
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    /** @type {any} */
    const release = await response.json();
    const currentVersion = app.getVersion();
    const latestVersion = release?.tag_name?.replace(/^v/, '') || currentVersion; // Remove 'v' prefix if present

    // Simple version comparison (works for semver)
    const hasUpdate = latestVersion !== currentVersion;

    return {
      hasUpdate,
      currentVersion,
      latestVersion,
      releaseNotes: release?.body || 'No release notes available.',
      downloadUrl: release?.html_url || null,
      publishedAt: release?.published_at || null,
    };
  } catch (error) {
    console.error('Failed to check for updates:', error);
    return {
      hasUpdate: false,
      currentVersion: app.getVersion(),
      latestVersion: null,
      releaseNotes: null,
      downloadUrl: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});
