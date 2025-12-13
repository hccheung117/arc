import {Menu} from 'electron'
import {deleteConversation, updateConversation, emitConversationEvent} from './messages'

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
            ? {type: 'separator' as const}
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

/**
 * Shows a native context menu for thread/conversation actions.
 * Data operations (delete, togglePin) are executed directly in main process.
 * Returns 'rename' for UI-only action, or null if no action needed.
 */
export async function showThreadContextMenu(
  threadId: string,
  isPinned: boolean
): Promise<'rename' | null> {
  const action = await createContextMenu([
    { label: 'Rename', action: 'rename' as const },
    { label: isPinned ? 'Unpin' : 'Pin', action: 'togglePin' as const },
    { type: 'separator' },
    { label: 'Delete', action: 'delete' as const },
  ])

  if (action === 'delete') {
    await deleteConversation(threadId)
    emitConversationEvent({ type: 'deleted', id: threadId })
    return null
  }

  if (action === 'togglePin') {
    const conversation = await updateConversation(threadId, { pinned: !isPinned })
    emitConversationEvent({ type: 'updated', conversation })
    return null
  }

  return action
}

// ============================================================================
// MESSAGE CONTEXT MENU
// ============================================================================

/**
 * Shows a native context menu for message actions.
 * Returns the selected action, leaving side effects to the caller.
 */
export function showMessageContextMenu(hasEditOption: boolean): Promise<'copy' | 'edit' | null> {
  const items: MenuItem<'copy' | 'edit'>[] = [{ label: 'Copy', action: 'copy' }]

  if (hasEditOption) {
    items.push({ label: 'Edit', action: 'edit' })
  }

  return createContextMenu(items)
}
