/**
 * UI IPC Handlers
 *
 * Orchestration layer for native UI operations (menus, dialogs).
 * Returns action strings only - NEVER executes domain logic.
 *
 * The renderer receives the action and calls the appropriate domain IPC.
 */

import type { IpcMain } from 'electron'
import { z } from 'zod'
import {
  showThreadContextMenu,
  showMessageContextMenu,
  type MessageMenuAction,
} from '@main/lib/ui'
import { validated, register } from '@main/foundation/ipc'

// ============================================================================
// SCHEMAS
// ============================================================================

const ThreadContextMenuParamsSchema = z.object({
  isPinned: z.boolean(),
  isInFolder: z.boolean(),
  folders: z.array(z.object({ id: z.string(), title: z.string() })),
})

// ============================================================================
// TYPES
// ============================================================================

/**
 * All possible thread context menu actions.
 * Renderer uses this to determine which domain IPC to call.
 */
type ThreadMenuAction =
  | 'rename'
  | 'duplicate'
  | 'togglePin'
  | 'delete'
  | 'newFolder'
  | 'removeFromFolder'
  | `moveToFolder:${string}`

// ============================================================================
// HANDLERS
// ============================================================================

const handlers = {
  /**
   * Shows thread context menu and returns the selected action.
   * Does NOT execute domain logic - renderer calls domain IPC based on action.
   */
  'arc:ui:showThreadContextMenu': validated(
    [ThreadContextMenuParamsSchema],
    async (params: z.infer<typeof ThreadContextMenuParamsSchema>): Promise<ThreadMenuAction | null> => {
      return showThreadContextMenu(params)
    },
  ),

  /**
   * Shows message context menu and returns the selected action.
   */
  'arc:ui:showMessageContextMenu': validated(
    [z.boolean()],
    async (hasEditOption: boolean): Promise<MessageMenuAction | null> => {
      return showMessageContextMenu(hasEditOption)
    },
  ),
}

// ============================================================================
// REGISTRATION
// ============================================================================

export function registerUIHandlers(ipcMain: IpcMain): void {
  register(ipcMain, handlers)
}
