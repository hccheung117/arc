import { BrowserWindow } from 'electron'
import { z } from 'zod'
import type { AIStreamEvent } from '@arc-types/arc-api'
import type { ProfileInstallResult } from '@arc-types/arc-file'

/**
 * Broadcasts a message to all open windows.
 */
export function broadcast<T>(channel: string, data: T): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(channel, data)
  }
}

// ============================================================================
// EVENT EMITTERS
// ============================================================================

export type ModelsEvent = { type: 'updated' }

export function emitModelsEvent(event: ModelsEvent): void {
  broadcast('arc:models:event', event)
}

export function emitAIStreamEvent(event: AIStreamEvent): void {
  broadcast('arc:ai:event', event)
}

export type ProfilesEvent =
  | { type: 'installed'; profile: ProfileInstallResult }
  | { type: 'uninstalled'; profileId: string }
  | { type: 'activated'; profileId: string | null }

export function emitProfilesEvent(event: ProfilesEvent): void {
  broadcast('arc:profiles:event', event)
}

export type ConversationEvent =
  | { type: 'created'; conversation: { id: string; title: string; pinned: boolean; createdAt: string; updatedAt: string } }
  | { type: 'updated'; conversation: { id: string; title: string; pinned: boolean; createdAt: string; updatedAt: string } }
  | { type: 'deleted'; id: string }

export function emitConversationEvent(event: ConversationEvent): void {
  broadcast('arc:conversations:event', event)
}

/**
 * Wraps an IPC handler with Zod schema validation for multiple arguments.
 */
export function validatedArgs<TSchema extends z.ZodTuple, TResult>(
  schema: TSchema,
  handler: (...args: z.infer<TSchema>) => Promise<TResult>
): (event: Electron.IpcMainInvokeEvent, ...args: unknown[]) => Promise<TResult> {
  return async (_event, ...args): Promise<TResult> => {
    const validated = schema.parse(args)
    return handler(...validated)
  }
}
