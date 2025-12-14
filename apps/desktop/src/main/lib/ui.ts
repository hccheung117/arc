/**
 * Native UI Building Blocks
 *
 * Pure utilities for creating native menus.
 * Returns selected actions without executing side effects.
 */

import { Menu } from 'electron'

// ============================================================================
// GENERIC CONTEXT MENU FACTORY
// ============================================================================

type MenuItem<T extends string> =
  | { label: string; action: T }
  | { type: 'separator' }

/**
 * Creates and shows a native context menu, returning the selected action.
 * Resolves to null if the menu is dismissed without selection.
 */
function createContextMenu<T extends string>(items: MenuItem<T>[]): Promise<T | null> {
  return new Promise((resolve) => {
    let resolved = false

    const menu = Menu.buildFromTemplate(items.map((item) =>
        'type' in item
            ? { type: 'separator' as const }
            : {
              label: item.label,
              click: () => {
                resolved = true
                resolve(item.action)
              },
            }
    ))

    menu.once('menu-will-close', () => {
      // Delay resolution to allow click handlers to fire first (macOS timing issue)
      setTimeout(() => {
        if (!resolved) resolve(null)
      }, 100)
    })

    menu.popup()
  })
}

// ============================================================================
// THREAD CONTEXT MENU
// ============================================================================

export type ThreadMenuAction = 'rename' | 'togglePin' | 'delete'

/**
 * Shows a native context menu for thread/conversation actions.
 * Returns the selected action, leaving side effects to the caller.
 */
export function showThreadContextMenu(isPinned: boolean): Promise<ThreadMenuAction | null> {
  return createContextMenu<ThreadMenuAction>([
    { label: 'Rename', action: 'rename' },
    { label: isPinned ? 'Unpin' : 'Pin', action: 'togglePin' },
    { type: 'separator' },
    { label: 'Delete', action: 'delete' },
  ])
}

// ============================================================================
// MESSAGE CONTEXT MENU
// ============================================================================

export type MessageMenuAction = 'copy' | 'edit'

/**
 * Shows a native context menu for message actions.
 * Returns the selected action, leaving side effects to the caller.
 */
export function showMessageContextMenu(hasEditOption: boolean): Promise<MessageMenuAction | null> {
  const items: MenuItem<MessageMenuAction>[] = [{ label: 'Copy', action: 'copy' }]

  if (hasEditOption) {
    items.push({ label: 'Edit', action: 'edit' })
  }

  return createContextMenu(items)
}
