import { Menu } from 'electron'
import type { ContextMenuAction } from '../../shared/conversations'

/**
 * Shows a native context menu for thread/conversation actions.
 * Returns the selected action or null if cancelled.
 */
export function showThreadContextMenu(currentPinnedState: boolean): Promise<ContextMenuAction> {
  return new Promise((resolve) => {
    const menu = Menu.buildFromTemplate([
      {
        label: 'Rename',
        click: () => resolve('rename'),
      },
      {
        label: currentPinnedState ? 'Unpin' : 'Pin',
        click: () => resolve('togglePin'),
      },
      { type: 'separator' },
      {
        label: 'Delete',
        click: () => resolve('delete'),
      },
    ])

    // Resolve with null if menu is closed without selection
    menu.once('menu-will-close', () => {
      // Use setImmediate to ensure click handlers have a chance to resolve first
      setImmediate(() => resolve(null))
    })

    menu.popup()
  })
}
