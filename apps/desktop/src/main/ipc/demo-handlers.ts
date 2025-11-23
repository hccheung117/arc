import type { IpcMain, IpcMainEvent, IpcMainInvokeEvent, WebContents } from 'electron'
import type { EchoResponse, PongEvent } from '../../types/arc-api'

/**
 * Demo IPC Handlers (M1: Hello World)
 *
 * Three handlers demonstrating the canonical IPC patterns from plan/ipc.md:
 * - arc:log   (Rule 1: One-Way, Renderer → Main)
 * - arc:echo  (Rule 2: Two-Way, Renderer → Main with Response)
 * - arc:ping  (Rule 1 + Rule 3: triggers delayed Push from Main → Renderer)
 */

/**
 * Rule 1: One-Way (fire-and-forget)
 * Logs message to main process console.
 */
function handleLog(_event: IpcMainEvent, message: string): void {
  console.log('[arc:log]', message)
}

/**
 * Rule 2: Two-Way (request/response)
 * Returns transformed message with metadata.
 */
function handleEcho(_event: IpcMainInvokeEvent, message: string): EchoResponse {
  return {
    original: message,
    uppercased: message.toUpperCase(),
    timestamp: Date.now(),
  }
}

/**
 * Rule 1 + Rule 3: One-Way trigger → delayed Push
 * Receives ping, waits 1 second, then pushes pong event to renderer.
 */
function handlePing(event: IpcMainEvent): void {
  const sentAt = Date.now()
  const sender: WebContents = event.sender

  setTimeout(() => {
    const pongEvent: PongEvent = {
      message: 'pong',
      sentAt,
      receivedAt: Date.now(),
    }
    sender.send('arc:pong', pongEvent)
  }, 1000)
}

/**
 * Registers all demo IPC handlers.
 * Called from main.ts during app initialization.
 */
export function registerDemoHandlers(ipcMain: IpcMain): void {
  // Rule 1: One-Way (ipcMain.on, no response)
  ipcMain.on('arc:log', handleLog)

  // Rule 2: Two-Way (ipcMain.handle, returns value)
  ipcMain.handle('arc:echo', handleEcho)

  // Rule 1: One-Way trigger for Push demo
  ipcMain.on('arc:ping', handlePing)
}
