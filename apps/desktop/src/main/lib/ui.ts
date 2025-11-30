import { Menu, clipboard } from 'electron'
import type { ContextMenuAction } from '@arc-types/conversations'
import type { MessageContextMenuAction } from '@arc-types/messages'

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

/**
 * Shows a native context menu for message actions.
 * Returns the selected action or null if cancelled.
 */
export function showMessageContextMenu(content: string, hasEditOption: boolean): Promise<MessageContextMenuAction> {
  return new Promise((resolve) => {
    let actionTaken = false

    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: 'Copy',
        click: () => {
          actionTaken = true
          clipboard.writeText(content)
          resolve('copy')
        },
      },
    ]

    if (hasEditOption) {
      template.push({
        label: 'Edit',
        click: () => {
          actionTaken = true
          resolve('edit')
        },
      })
    }

    const menu = Menu.buildFromTemplate(template)

    // Resolve with null if menu is closed without selection
    menu.once('menu-will-close', () => {
      // Delay resolution to allow click handlers to fire first (macOS timing issue)
      setTimeout(() => {
        if (!actionTaken) {
          resolve(null)
        }
      }, 100)
    })

    menu.popup()
  })
}
