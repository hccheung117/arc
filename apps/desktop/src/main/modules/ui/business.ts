/**
 * UI Business Logic
 *
 * Context menus and window state management.
 * Pure utilities for native menus with side effects isolated to window tracking.
 */

import { type BrowserWindow, Menu, type MenuItemConstructorOptions, screen } from 'electron'

// ─────────────────────────────────────────────────────────────────────────────
// Business Interfaces
// ─────────────────────────────────────────────────────────────────────────────

interface WindowState {
  width: number
  height: number
}

interface WindowStateStore {
  read(): Promise<WindowState>
  write(data: WindowState): Promise<void>
}

interface UIConstants {
  DEFAULT_SIZE: WindowState
  MIN_SIZE: WindowState
}

interface Logger {
  warn(msg: string): void
  error(msg: string, err: Error): void
}

const DEFAULT_SIZE: WindowState = { width: 800, height: 600 }
export const MIN_SIZE: WindowState = { width: 700, height: 550 }

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

interface ThreadContextMenuParams {
  isPinned: boolean
  isInFolder: boolean
  folders: FolderInfo[]
}

type ThreadMenuAction = 'rename' | 'duplicate' | 'togglePin' | 'delete' | 'newFolder' | 'removeFromFolder' | `moveToFolder:${string}`

export const showThreadContextMenu = ({ isPinned, isInFolder, folders }: ThreadContextMenuParams) => {
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

export type MessageMenuAction = 'copy' | 'edit'

export const showMessageContextMenu = (hasEditOption: boolean) =>
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

export const setupEditableContextMenu = (window: BrowserWindow) => {
  window.webContents.on('context-menu', (_event, params) => {
    if (!params.isEditable) return
    Menu.buildFromTemplate([
      ...spellingSection(params, window.webContents),
      ...editOperations,
    ]).popup()
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Menu Operations Factory
// ─────────────────────────────────────────────────────────────────────────────

export const createMenuOperations = () => ({
  showThreadContextMenu,
  showMessageContextMenu,
  setupEditableContextMenu,
})

// ─────────────────────────────────────────────────────────────────────────────
// Window State Helpers
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

// ─────────────────────────────────────────────────────────────────────────────
// Window State
// ─────────────────────────────────────────────────────────────────────────────

export interface WindowStateOperations {
  readWindowState: () => Promise<WindowState>
  writeWindowState: (size: WindowState) => Promise<void>
  trackWindowState: (window: BrowserWindow) => void
}

export const createWindowStateOperations = (
  store: { windowState: WindowStateStore; constants: UIConstants },
  logger: Logger
): WindowStateOperations => {
  const readWindowState = async (): Promise<WindowState> => {
    try {
      return await store.windowState.read()
    } catch {
      logger.warn('Failed to restore window size, using default')
      return DEFAULT_SIZE
    }
  }

  const writeWindowState = async (size: WindowState): Promise<void> => {
    await store.windowState.write(size)
  }

  const trackWindowState = (window: BrowserWindow): void => {
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
