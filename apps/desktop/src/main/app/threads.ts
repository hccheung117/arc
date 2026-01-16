/**
 * Thread IPC Handlers
 *
 * Orchestration layer: routes ALL thread/folder IPC to command handler.
 * This is the SINGLE entry point for all thread operations.
 *
 * Pattern: IPC → Contract Validation → Command → Effect { result, events } → Broadcast → Return
 */

import type { IpcMain } from 'electron'
import type { StoredThread } from '@boundary/messages'
import { execute, listThreads, type ThreadEvent } from '@main/lib/messages/commands'
import { broadcast } from '@main/foundation/ipc'
import { registerHandlers } from '@main/foundation/contract'
import { threadsContract, foldersContract } from '@contracts/threads'

// ============================================================================
// EVENT BROADCASTING
// ============================================================================

function broadcastThreadEvents(events: ThreadEvent[]): void {
  for (const event of events) {
    broadcast('arc:threads:event', event)
  }
}

// ============================================================================
// REGISTRATION
// ============================================================================

export function registerThreadHandlers(ipcMain: IpcMain): void {
  // Threads operations
  registerHandlers(ipcMain, threadsContract, {
    list: async () => listThreads(),

    update: async ({ threadId, patch }) => {
      const { result, events } = await execute({ type: 'update', threadId, patch })
      broadcastThreadEvents(events)
      return result as StoredThread
    },

    delete: async ({ threadId }) => {
      const { events } = await execute({ type: 'delete', threadId })
      broadcastThreadEvents(events)
    },

    duplicate: async ({ threadId, upToMessageId }) => {
      const { result, events } = await execute({ type: 'duplicate', threadId, upToMessageId })
      broadcastThreadEvents(events)
      return result as StoredThread
    },
  })

  // Folders operations
  registerHandlers(ipcMain, foldersContract, {
    create: async ({ name, threadId1, threadId2 }) => {
      const { result, events } = await execute({
        type: 'create-folder',
        name,
        threadIds: [threadId1, threadId2],
      })
      broadcastThreadEvents(events)
      return result as StoredThread
    },

    createWithThread: async ({ threadId }) => {
      const { result, events } = await execute({ type: 'create-folder-with-thread', threadId })
      broadcastThreadEvents(events)
      return result as StoredThread
    },

    moveThread: async ({ threadId, folderId }) => {
      const { events } = await execute({ type: 'move-to-folder', threadId, folderId })
      broadcastThreadEvents(events)
    },

    moveToRoot: async ({ threadId }) => {
      const { events } = await execute({ type: 'move-to-root', threadId })
      broadcastThreadEvents(events)
    },

    reorder: async ({ folderId, orderedChildIds }) => {
      const { events } = await execute({ type: 'reorder-in-folder', folderId, orderedIds: orderedChildIds })
      broadcastThreadEvents(events)
    },
  })
}
