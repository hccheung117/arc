import { BrowserWindow } from 'electron'
import { z } from 'zod'

/**
 * Broadcasts a message to all open windows.
 */
export function broadcast<T>(channel: string, data: T): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(channel, data)
  }
}

/**
 * Infers argument types from a tuple of Zod schemas.
 */
type InferArgs<T extends z.ZodTypeAny[]> = {
  [K in keyof T]: T[K] extends z.ZodTypeAny ? z.infer<T[K]> : never
}

/**
 * Creates a validated IPC handler with Zod schema validation baked in.
 * The handler carries its own contract—schema and implementation together.
 */
export function validated<T extends [z.ZodTypeAny, ...z.ZodTypeAny[]], R>(
  schemas: T,
  handler: (...args: InferArgs<T>) => Promise<R>
): (event: Electron.IpcMainInvokeEvent, ...args: unknown[]) => Promise<R> {
  const schema = z.tuple(schemas)
  return async (_event, ...args) => {
    const result = schema.parse(args)
    return handler(...(result as InferArgs<T>))
  }
}
