import { BrowserWindow } from 'electron'

/**
 * Broadcasts a message to all open windows.
 */
export function broadcast<T>(channel: string, data: T): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(channel, data)
  }
}
