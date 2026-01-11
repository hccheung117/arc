/**
 * Thread IPC Handlers
 *
 * Orchestration layer: routes ALL thread/folder IPC to command handler.
 * This is the SINGLE entry point for all thread operations.
 *
 * Pattern: IPC → Command → Effect { result, events } → Broadcast → Return
 */

import type { IpcMain } from 'electron'
import { z } from 'zod'
import type { StoredThread } from '@main/lib/messages/schemas'
import { execute, listThreads, type ThreadEvent } from '@main/lib/messages/commands'
import { validated, broadcast, register } from '@main/foundation/ipc'

// ============================================================================
// SCHEMAS
// ============================================================================

const ThreadPatchSchema = z.object({
  title: z.string().optional(),
  pinned: z.boolean().optional(),
  systemPrompt: z.string().nullable().optional(),
})

// ============================================================================
// EVENT BROADCASTING
// ============================================================================

function broadcastThreadEvents(events: ThreadEvent[]): void {
  for (const event of events) {
    broadcast('arc:threads:event', event)
  }
}

// ============================================================================
// HANDLERS
// ============================================================================

const handlers = {
  // Read-only: no command, just query
  'arc:threads:list': listThreads,

  'arc:threads:update': validated(
    [z.string(), ThreadPatchSchema],
    async (threadId: string, patch: z.infer<typeof ThreadPatchSchema>): Promise<StoredThread> => {
      const { result, events } = await execute({ type: 'update', threadId, patch })
      broadcastThreadEvents(events)
      return result as StoredThread
    },
  ),

  'arc:threads:delete': validated([z.string()], async (threadId: string): Promise<void> => {
    const { events } = await execute({ type: 'delete', threadId })
    broadcastThreadEvents(events)
  }),

  'arc:threads:duplicate': validated(
    [z.string(), z.string().optional()],
    async (threadId: string, upToMessageId?: string): Promise<StoredThread> => {
      const { result, events } = await execute({ type: 'duplicate', threadId, upToMessageId })
      broadcastThreadEvents(events)
      return result as StoredThread
    },
  ),

  'arc:folders:create': validated(
    [z.string(), z.string(), z.string()],
    async (name: string, threadId1: string, threadId2: string): Promise<StoredThread> => {
      const { result, events } = await execute({
        type: 'create-folder',
        name,
        threadIds: [threadId1, threadId2],
      })
      broadcastThreadEvents(events)
      return result as StoredThread
    },
  ),

  'arc:folders:createWithThread': validated(
    [z.string()],
    async (threadId: string): Promise<StoredThread> => {
      const { result, events } = await execute({ type: 'create-folder-with-thread', threadId })
      broadcastThreadEvents(events)
      return result as StoredThread
    },
  ),

  'arc:folders:moveThread': validated(
    [z.string(), z.string()],
    async (threadId: string, folderId: string): Promise<void> => {
      const { events } = await execute({ type: 'move-to-folder', threadId, folderId })
      broadcastThreadEvents(events)
    },
  ),

  'arc:folders:moveToRoot': validated([z.string()], async (threadId: string): Promise<void> => {
    const { events } = await execute({ type: 'move-to-root', threadId })
    broadcastThreadEvents(events)
  }),

  'arc:folders:reorder': validated(
    [z.string(), z.array(z.string())],
    async (folderId: string, orderedIds: string[]): Promise<void> => {
      const { events } = await execute({ type: 'reorder-in-folder', folderId, orderedIds })
      broadcastThreadEvents(events)
    },
  ),
}

// ============================================================================
// REGISTRATION
// ============================================================================

export function registerThreadHandlers(ipcMain: IpcMain): void {
  register(ipcMain, handlers)
}
