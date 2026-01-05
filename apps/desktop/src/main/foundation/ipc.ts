import type { IpcMain } from 'electron'
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

/** Registers all handlers in a channel→handler record */
export const register = (ipcMain: IpcMain, handlers: Record<string, Parameters<IpcMain['handle']>[1]>) =>
  Object.entries(handlers).forEach(([channel, handler]) => ipcMain.handle(channel, handler))

// ============================================================================
// COMBINATORS
// ============================================================================

type AsyncFn<A extends unknown[], R> = (...args: A) => Promise<R>

/** Emits event after successful operation, returns original result */
export const withEmit =
  <E>(emit: (e: E) => void) =>
  <A extends unknown[], R>(toEvent: (result: R, ...args: A) => E) =>
  (fn: AsyncFn<A, R>): AsyncFn<A, R> =>
  async (...args) => {
    const result = await fn(...args)
    emit(toEvent(result, ...args))
    return result
  }

/** Conditionally emits when result is truthy */
export const withEmitIf =
  <E>(emit: (e: E) => void) =>
  <A extends unknown[], R>(toEvent: (result: NonNullable<R>) => E) =>
  (fn: AsyncFn<A, R | undefined>): AsyncFn<A, R | undefined> =>
  async (...args) => {
    const result = await fn(...args)
    if (result) emit(toEvent(result as NonNullable<R>))
    return result
  }
