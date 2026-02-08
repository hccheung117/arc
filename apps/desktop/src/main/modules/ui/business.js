import { app, BrowserWindow, Menu, screen, shell } from 'electron'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const MIN_SIZE = { width: 700, height: 550 }

// ─────────────────────────────────────────────────────────────────────────────
// Menu Pure Transformations
// ─────────────────────────────────────────────────────────────────────────────

const isSeparator = (item) =>
  'type' in item

const isSubmenu = (item) =>
  'submenu' in item

const toElectronMenuItem = (resolve) =>
  (item) => {
    if (isSeparator(item)) return { type: 'separator' }
    if (isSubmenu(item)) return { label: item.label, submenu: item.submenu.map(toElectronMenuItem(resolve)) }
    return { label: item.label, click: () => resolve(item.action) }
  }

// ─────────────────────────────────────────────────────────────────────────────
// Generic Context Menu Factory
// ─────────────────────────────────────────────────────────────────────────────

const createContextMenu = (items) =>
  new Promise((resolve) => {
    let selected = null

    const menu = Menu.buildFromTemplate(
      items.map(toElectronMenuItem((action) => { selected = action }))
    )

    menu.once('menu-will-close', () => {
      setTimeout(() => resolve(selected), 100)
    })

    menu.popup()
  })

// ─────────────────────────────────────────────────────────────────────────────
// Thread Context Menu
// ─────────────────────────────────────────────────────────────────────────────

const showThreadContextMenu = ({ isPinned, isInFolder, folders }) => {
  const folderSubmenu = [
    ...folders.map((f) => ({ label: f.title, action: `moveToFolder:${f.id}` })),
    ...(folders.length > 0 ? [{ type: 'separator' }] : []),
    { label: 'New Folder...', action: 'newFolder' },
  ]

  const items = [
    { label: 'Rename', action: 'rename' },
    { label: 'Duplicate', action: 'duplicate' },
    ...(!isInFolder ? [{ label: isPinned ? 'Unpin' : 'Pin', action: 'togglePin' }] : []),
    { type: 'separator' },
    { label: 'Move to Folder', submenu: folderSubmenu },
    ...(isInFolder ? [{ label: 'Remove from Folder', action: 'removeFromFolder' }] : []),
    { type: 'separator' },
    { label: 'Delete', action: 'delete' },
  ]

  return createContextMenu(items)
}

// ─────────────────────────────────────────────────────────────────────────────
// Message Context Menu
// ─────────────────────────────────────────────────────────────────────────────

const showMessageContextMenu = ({ hasEditOption }) =>
  createContextMenu(hasEditOption
    ? [{ label: 'Copy', action: 'copy' }, { label: 'Edit', action: 'edit' }]
    : [{ label: 'Copy', action: 'copy' }])

// ─────────────────────────────────────────────────────────────────────────────
// Editable Element Context Menu
// ─────────────────────────────────────────────────────────────────────────────

const spellingSuggestions = (
  params,
  webContents
) =>
  params.dictionarySuggestions.length > 0
    ? params.dictionarySuggestions.map((suggestion) => ({
        label: suggestion,
        click: () => webContents.replaceMisspelling(suggestion),
      }))
    : [{ label: 'No suggestions', enabled: false }]

const addToDictionary = (
  params,
  webContents
) => ({
  label: 'Add to Dictionary',
  click: () => webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord),
})

const spellingSection = (
  params,
  webContents
) =>
  params.misspelledWord
    ? [
        ...spellingSuggestions(params, webContents),
        { type: 'separator' },
        addToDictionary(params, webContents),
        { type: 'separator' },
      ]
    : []

const editOperations = [
  { role: 'undo' },
  { role: 'redo' },
  { type: 'separator' },
  { role: 'cut' },
  { role: 'copy' },
  { role: 'paste' },
  { type: 'separator' },
  { role: 'selectAll' },
]

const setupEditableContextMenu = (window) => {
  window.webContents.on('context-menu', (_event, params) => {
    if (!params.isEditable) return
    Menu.buildFromTemplate([
      ...spellingSection(params, window.webContents),
      ...editOperations,
    ]).popup()
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Window State
// ─────────────────────────────────────────────────────────────────────────────

const fitToDisplay = (window) => {
  const bounds = window.getBounds()
  const display = screen.getDisplayMatching(bounds)
  const { workAreaSize } = display

  const clampedWidth = Math.min(bounds.width, workAreaSize.width)
  const clampedHeight = Math.min(bounds.height, workAreaSize.height)

  if (clampedWidth !== bounds.width || clampedHeight !== bounds.height) {
    window.setSize(clampedWidth, clampedHeight)
  }
}

const createWindowStateOperations = (store, logger) => {
  const readWindowState = async () => {
    try {
      return await store.readWindowState()
    } catch {
      logger.warn('Failed to restore window size, using default')
      return { width: 800, height: 600 }
    }
  }

  const writeWindowState = async (size) => {
    await store.writeWindowState(size)
  }

  const trackWindowState = (window) => {
    fitToDisplay(window)

    let debounceTimer = null

    const saveSize = () => {
      const [width, height] = window.getSize()
      writeWindowState({ width, height }).catch((err) => {
        logger.error('Failed to save window size', err)
      })
    }

    window.on('resize', () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(saveSize, 500)
    })

    window.on('close', () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      saveSize()
    })
  }

  return { readWindowState, writeWindowState, trackWindowState }
}

// ─────────────────────────────────────────────────────────────────────────────
// App Menu
// ─────────────────────────────────────────────────────────────────────────────

const buildAppMenu = () => {
  const viewSubmenu = [
    { role: 'togglefullscreen' },
  ]

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    viewSubmenu.push(
      { type: 'separator' },
      {
        role: 'toggleDevTools',
        accelerator: process.platform === 'darwin' ? 'Command+Alt+I' : 'Control+Shift+I',
      },
    )
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
    ])
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
  ])
}

// ─────────────────────────────────────────────────────────────────────────────
// Module API Factory
// ─────────────────────────────────────────────────────────────────────────────

export const createOperations = (store, logger) => ({
  getMinSize: () => MIN_SIZE,
  buildAppMenu,
  showThreadContextMenu,
  showMessageContextMenu,
  setupEditableContextMenu,
  openFile: async ({ filePath }) => { await shell.openPath(filePath) },
  ...createWindowStateOperations(store, logger),
})
