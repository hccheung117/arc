/**
 * Contract-First IPC
 *
 * Define IPC contracts once with Zod, derive everything else:
 * - Channel names (compile-time safe)
 * - Handler registration (with validation)
 * - Preload client generation
 * - TypeScript types
 *
 * Single object parameter pattern: all operations receive one object
 * (or void for parameterless operations).
 */

import type { IpcMain, IpcMainInvokeEvent, IpcRenderer } from 'electron'
import { BrowserWindow } from 'electron'
import { z } from 'zod'

// ============================================================================
// BROADCAST
// ============================================================================

/**
 * Broadcasts a message to all open windows.
 */
export function broadcast<T>(channel: string, data: T): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(channel, data)
  }
}

// ============================================================================
// MODULE EMITTER
// ============================================================================

/**
 * Creates a scoped emitter for a module that validates event names
 * against the module's `emits` declaration and broadcasts to per-event channels.
 */
export function createModuleEmitter(
  moduleName: string,
  declaredEvents: readonly string[]
): (event: string, data: unknown) => void {
  return (event, data) => {
    if (!declaredEvents.includes(event)) {
      throw new Error(
        `Module "${moduleName}" emitted undeclared event "${event}". Declared: [${declaredEvents.join(', ')}]`
      )
    }
    broadcast(channel(moduleName, event), data)
  }
}

// ============================================================================
// CONTRACT DEFINITION
// ============================================================================

/**
 * Operation specification: input schema + output type marker.
 * Output is TypeScript-only (no runtime validation on responses).
 */
type Operation<I extends z.ZodTypeAny = z.ZodTypeAny, O = unknown> = {
  input: I
  _output?: O // Phantom type for inference
}

/** Helper to define an operation with type inference */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const op = <I extends z.ZodTypeAny, O>(input: I, _output?: O): Operation<I, O> => ({ input })

/** Type marker for output (no runtime value) */
export const returns = <T>() => undefined as unknown as T

/** A domain contract: map of operation names to specs */
type ContractSpec = Record<string, Operation>

/** Domain contract with metadata */
export type Contract<T extends ContractSpec = ContractSpec> = {
  domain: string
  operations: T
}

/** Create a domain contract */
export const contract = <T extends ContractSpec>(domain: string, operations: T): Contract<T> => ({
  domain,
  operations,
})

// ============================================================================
// TYPE INFERENCE
// ============================================================================

/** Infer the input type for an operation (void if z.void()) */
type InferInput<Op extends Operation> = Op['input'] extends z.ZodVoid
  ? void
  : z.infer<Op['input']>

/** Infer the output type for an operation */
type InferOutput<Op extends Operation> = Op extends Operation<z.ZodTypeAny, infer O> ? O : unknown

/** Handler function type for an operation */
type Handler<Op extends Operation> = InferInput<Op> extends void
  ? () => Promise<InferOutput<Op>>
  : (input: InferInput<Op>) => Promise<InferOutput<Op>>

/** All handlers for a contract */
export type Handlers<C extends Contract> = {
  [K in keyof C['operations']]: Handler<C['operations'][K]>
}

/** Client API surface for a contract */
export type Client<C extends Contract> = {
  [K in keyof C['operations']]: Handler<C['operations'][K]>
}

// ============================================================================
// CHANNEL NAMES
// ============================================================================

/** Derive IPC channel name: arc:{domain}:{operation} */
const channel = (domain: string, operation: string) => `arc:${domain}:${operation}`

// ============================================================================
// HANDLER REGISTRATION (Main Process)
// ============================================================================

/**
 * Register handlers for a contract.
 * Validates input with Zod, calls implementation, returns result.
 */
export const registerHandlers = <C extends Contract>(
  ipcMain: IpcMain,
  c: C,
  handlers: Handlers<C>,
): void => {
  for (const [name, spec] of Object.entries(c.operations)) {
    const ch = channel(c.domain, name)
    const handler = handlers[name as keyof typeof handlers]

    ipcMain.handle(ch, async (_event: IpcMainInvokeEvent, input: unknown) => {
      // Validate input (void operations receive undefined)
      const validated = spec.input.parse(input)
      // Call handler with validated input
      return (handler as (input: unknown) => Promise<unknown>)(validated)
    })
  }
}

// ============================================================================
// CLIENT GENERATION (Preload)
// ============================================================================

/**
 * Generate a typed client for a contract.
 * Each operation becomes a method that invokes the IPC channel.
 *
 * @param ipc - ipcRenderer instance (passed to avoid top-level import)
 * @param c - Contract definition
 */
export const createClient = <C extends Contract>(ipc: IpcRenderer, c: C): Client<C> => {
  const client = {} as Record<string, (input?: unknown) => Promise<unknown>>

  for (const name of Object.keys(c.operations)) {
    const ch = channel(c.domain, name)
    client[name] = (input?: unknown) => ipc.invoke(ch, input)
  }

  return client as Client<C>
}

// ============================================================================
// MODULE AUTO-REGISTRATION
// ============================================================================

/**
 * Auto-registers IPC handlers for a module.
 * Derives channel names from module name + operation keys.
 * Channel format: arc:{moduleName}:{operationName}
 *
 * No validation - renderer is trusted code. Domain validation in business logic.
 */
export function registerModuleIPC(
  ipcMain: IpcMain,
  moduleName: string,
  api: Record<string, (...args: unknown[]) => unknown>
): void {
  for (const operationName of Object.keys(api)) {
    const ch = channel(moduleName, operationName)
    const handler = api[operationName]

    ipcMain.handle(ch, async (_event: IpcMainInvokeEvent, input: unknown) => {
      return handler(input)
    })
  }
}
