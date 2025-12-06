/**
 * IPC Validation Helper
 *
 * Provides type-safe validation wrapper for IPC handlers.
 * Validates input data against Zod schemas before passing to handler.
 */

import type { IpcMainInvokeEvent } from 'electron'
import type { z } from 'zod'

/**
 * Wraps an IPC handler with Zod schema validation.
 * Throws ZodError if validation fails.
 *
 * @param schema - Zod schema to validate input against
 * @param handler - Handler function that receives validated data
 * @returns Wrapped handler function for ipcMain.handle
 */
export function validated<TSchema extends z.ZodType, TResult>(
  schema: TSchema,
  handler: (data: z.infer<TSchema>) => Promise<TResult>
): (event: IpcMainInvokeEvent, data: unknown) => Promise<TResult> {
  return async (_event: IpcMainInvokeEvent, data: unknown): Promise<TResult> => {
    const validated = schema.parse(data)
    return handler(validated)
  }
}

/**
 * Wraps an IPC handler with Zod schema validation for multiple arguments.
 * Validates a tuple of arguments.
 *
 * @param schema - Zod tuple schema to validate arguments against
 * @param handler - Handler function that receives validated arguments
 * @returns Wrapped handler function for ipcMain.handle
 */
export function validatedArgs<TSchema extends z.ZodTuple, TResult>(
  schema: TSchema,
  handler: (...args: z.infer<TSchema>) => Promise<TResult>
): (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<TResult> {
  return async (_event: IpcMainInvokeEvent, ...args: unknown[]): Promise<TResult> => {
    const validated = schema.parse(args)
    return handler(...validated)
  }
}
