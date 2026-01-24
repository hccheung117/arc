/**
 * System IPC Handlers
 *
 * Logging handler for renderer-reported errors.
 */

import type { IpcMain } from 'electron'
import { rendererError } from '@main/foundation/logger'

export function registerSystemHandlers(ipcMain: IpcMain): void {
  ipcMain.on('arc:log:error', (_event, tag: string, message: string, stack?: string) => {
    rendererError(tag, message, stack)
  })
}
