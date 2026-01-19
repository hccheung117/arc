/**
 * UI IPC Handlers
 *
 * Orchestration layer for native UI operations (menus, dialogs).
 * Returns action strings only - NEVER executes domain logic.
 *
 * The renderer receives the action and calls the appropriate domain IPC.
 */

import type { IpcMain } from 'electron'
import {
  showThreadContextMenu,
  showMessageContextMenu,
} from '@main/lib/ui'
import { registerHandlers } from '@main/kernel/ipc'
import { uiContract } from '@contracts/ui'

// ============================================================================
// REGISTRATION
// ============================================================================

export function registerUIHandlers(ipcMain: IpcMain): void {
  registerHandlers(ipcMain, uiContract, {
    showThreadContextMenu: async (params) => showThreadContextMenu(params),
    showMessageContextMenu: async ({ hasEditOption }) => showMessageContextMenu(hasEditOption),
  })
}
