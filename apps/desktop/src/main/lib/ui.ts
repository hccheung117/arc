/**
 * Native UI Building Blocks
 *
 * Pure utilities for creating native menus.
 * Returns selected actions without executing side effects.
 */

import {type BrowserWindow, Menu, type MenuItemConstructorOptions} from 'electron'

// ============================================================================
// TYPES
// ============================================================================

type MenuItem<T extends string> =
  | { label: string; action: T }
  | { type: 'separator' }

// ============================================================================
// PURE TRANSFORMATIONS
// ============================================================================

const isSeparator = <T extends string>(item: MenuItem<T>): item is { type: 'separator' } =>
  'type' in item

const toElectronMenuItem = <T extends string>(resolve: (action: T) => void) =>
  (item: MenuItem<T>): MenuItemConstructorOptions =>
    isSeparator(item)
      ? { type: 'separator' }
      : { label: item.label, click: () => resolve(item.action) }

// ============================================================================
// GENERIC CONTEXT MENU FACTORY
// ============================================================================

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

// ============================================================================
// THREAD CONTEXT MENU
// ============================================================================

export const showThreadContextMenu = (isPinned: boolean) =>
  createContextMenu([
      {label: 'Rename', action: 'rename'},
      {label: isPinned ? 'Unpin' : 'Pin', action: 'togglePin'},
      {type: 'separator'},
      {label: 'Delete', action: 'delete'},
  ])

// ============================================================================
// MESSAGE CONTEXT MENU
// ============================================================================

export type MessageMenuAction = 'copy' | 'edit'

export const showMessageContextMenu = (hasEditOption: boolean) =>
  createContextMenu(hasEditOption
      ? [{label: 'Copy', action: 'copy'}, {label: 'Edit', action: 'edit'}]
      : [{label: 'Copy', action: 'copy'}])

// ============================================================================
// EDITABLE ELEMENT CONTEXT MENU
// ============================================================================

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