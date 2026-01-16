/**
 * UI Contract
 *
 * Native UI operations (context menus).
 * Returns action strings only - NEVER executes domain logic.
 */

import { z } from 'zod'
import { contract, op } from '@main/foundation/contract'

// ============================================================================
// TYPES
// ============================================================================

export type ThreadMenuAction =
  | 'rename'
  | 'duplicate'
  | 'togglePin'
  | 'delete'
  | 'newFolder'
  | 'removeFromFolder'
  | `moveToFolder:${string}`

export type MessageMenuAction = 'copy' | 'edit'

// ============================================================================
// SCHEMAS
// ============================================================================

export const ThreadContextMenuParamsSchema = z.object({
  isPinned: z.boolean(),
  isInFolder: z.boolean(),
  folders: z.array(z.object({ id: z.string(), title: z.string() })),
})

// ============================================================================
// CONTRACT
// ============================================================================

export const uiContract = contract('ui', {
  /**
   * Show thread context menu.
   * Returns the selected action. Renderer calls domain IPC based on action.
   */
  showThreadContextMenu: op(
    ThreadContextMenuParamsSchema,
    null as ThreadMenuAction | null,
  ),

  /** Show message context menu */
  showMessageContextMenu: op(
    z.object({ hasEditOption: z.boolean() }),
    null as MessageMenuAction | null,
  ),
})

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type ThreadContextMenuParams = z.infer<typeof ThreadContextMenuParamsSchema>
