import { app, type BrowserWindow, Menu, type MenuItemConstructorOptions, screen, shell } from 'electron'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const MIN_SIZE = { width: 700, height: 550 }

// ─────────────────────────────────────────────────────────────────────────────
// Menu Types
// ─────────────────────────────────────────────────────────────────────────────

type MenuItem<T extends string> =
  | { label: string; action: T }
  | { label: string; submenu: MenuItem<T>[] }
  | { type: 'separator' }

// ─────────────────────────────────────────────────────────────────────────────
// Menu Pure Transformations
// ─────────────────────────────────────────────────────────────────────────────

const isSeparator = <T extends string>(item: MenuItem<T>): item is { type: 'separator' } =>
  'type' in item

const isSubmenu = <T extends string>(item: MenuItem<T>): item is { label: string; submenu: MenuItem<T>[] } =>
  'submenu' in item

const toElectronMenuItem = <T extends string>(resolve: (action: T) => void) =>
  (item: MenuItem<T>): MenuItemConstructorOptions => {
    if (isSeparator(item)) return { type: 'separator' }
    if (isSubmenu(item)) return { label: item.label, submenu: item.submenu.map(toElectronMenuItem(resolve)) }
    return { label: item.label, click: () => resolve(item.action) }
  }

// ─────────────────────────────────────────────────────────────────────────────
// Generic Context Menu Factory
// ─────────────────────────────────────────────────────────────────────────────

const createContextMenu = <T extends string>(items: MenuItem<T>[]) =>
  new Promise<T | null>((resolve) => {
    let selected: T | null = null

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

interface FolderInfo {
  id: string
  title: string
}

export interface ThreadContextMenuParams {
  isPinned: boolean
  isInFolder: boolean
  folders: FolderInfo[]
}

export type ThreadMenuAction = 'rename' | 'duplicate' | 'togglePin' | 'delete' | 'newFolder' | 'removeFromFolder' | `moveToFolder:${string}`

export type MessageMenuAction = 'copy' | 'edit'

const showThreadContextMenu = ({ isPinned, isInFolder, folders }: ThreadContextMenuParams) => {
  const folderSubmenu: MenuItem<ThreadMenuAction>[] = [
    ...folders.map((f) => ({ label: f.title, action: `moveToFolder:${f.id}` as const })),
    ...(folders.length > 0 ? [{ type: 'separator' } as const] : []),
    { label: 'New Folder...', action: 'newFolder' as const },
  ]

  const items: MenuItem<ThreadMenuAction>[] = [
    { label: 'Rename', action: 'rename' },
    { label: 'Duplicate', action: 'duplicate' },
    ...(!isInFolder ? [{ label: isPinned ? 'Unpin' : 'Pin', action: 'togglePin' } as const] : []),
    { type: 'separator' },
    { label: 'Move to Folder', submenu: folderSubmenu },
    ...(isInFolder ? [{ label: 'Remove from Folder', action: 'removeFromFolder' } as const] : []),
    { type: 'separator' },
    { label: 'Delete', action: 'delete' },
  ]

  return createContextMenu(items)
}

// ─────────────────────────────────────────────────────────────────────────────
// Message Context Menu
// ─────────────────────────────────────────────────────────────────────────────

const showMessageContextMenu = ({ hasEditOption }: { hasEditOption: boolean }) =>
  createContextMenu(hasEditOption
    ? [{ label: 'Copy', action: 'copy' }, { label: 'Edit', action: 'edit' }]
    : [{ label: 'Copy', action: 'copy' }])

// ─────────────────────────────────────────────────────────────────────────────
// Editable Element Context Menu
// ─────────────────────────────────────────────────────────────────────────────

const spellingSuggestions = (
  params: Electron.ContextMenuParams,
  webContents: Electron.WebContents
) =>
  params.dictionarySuggestions.length > 0
    ? params.dictionarySuggestions.map((suggestion) => ({
        label: suggestion,
        click: () => webContents.replaceMisspelling(suggestion),
      }))
    : [{ label: 'No suggestions', enabled: false }]

const addToDictionary = (
  params: Electron.ContextMenuParams,
  webContents: Electron.WebContents
): MenuItemConstructorOptions => ({
  label: 'Add to Dictionary',
  click: () => webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord),
})

const spellingSection = (
  params: Electron.ContextMenuParams,
  webContents: Electron.WebContents
) =>
  params.misspelledWord
    ? [
        ...spellingSuggestions(params, webContents),
        { type: 'separator' } as const,
        addToDictionary(params, webContents),
        { type: 'separator' } as const,
      ]
    : []

const editOperations: MenuItemConstructorOptions[] = [
  { role: 'undo' },
  { role: 'redo' },
  { type: 'separator' },
  { role: 'cut' },
  { role: 'copy' },
  { role: 'paste' },
  { type: 'separator' },
  { role: 'selectAll' },
]

const setupEditableContextMenu = (window: BrowserWindow) => {
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

const fitToDisplay = (window: BrowserWindow): void => {
  const bounds = window.getBounds()
  const display = screen.getDisplayMatching(bounds)
  const { workAreaSize } = display

  const clampedWidth = Math.min(bounds.width, workAreaSize.width)
  const clampedHeight = Math.min(bounds.height, workAreaSize.height)

  if (clampedWidth !== bounds.width || clampedHeight !== bounds.height) {
    window.setSize(clampedWidth, clampedHeight)
  }
}

interface WindowStateStore {
  readWindowState(): Promise<{ width: number; height: number }>
  writeWindowState(size: { width: number; height: number }): Promise<void>
}

interface Logger {
  warn(msg: string): void
  error(msg: string, err: Error): void
}

const createWindowStateOperations = (store: WindowStateStore, logger: Logger) => {
  const readWindowState = async () => {
    try {
      return await store.readWindowState()
    } catch {
      logger.warn('Failed to restore window size, using default')
      return { width: 800, height: 600 }
    }
  }

  const writeWindowState = async (size: { width: number; height: number }) => {
    await store.writeWindowState(size)
  }

  const trackWindowState = (window: BrowserWindow) => {
    fitToDisplay(window)

    let debounceTimer: NodeJS.Timeout | null = null

    const saveSize = () => {
      const [width, height] = window.getSize()
      writeWindowState({ width, height }).catch((err) => {
        logger.error('Failed to save window size', err as Error)
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
  const viewSubmenu: MenuItemConstructorOptions[] = [
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

export const createOperations = (store: WindowStateStore, logger: Logger) => ({
  getMinSize: () => MIN_SIZE,
  buildAppMenu,
  showThreadContextMenu,
  showMessageContextMenu,
  setupEditableContextMenu,
  openFile: async ({ filePath }: { filePath: string }) => { await shell.openPath(filePath) },
  ...createWindowStateOperations(store, logger),
})
