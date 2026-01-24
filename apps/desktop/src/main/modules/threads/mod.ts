/**
 * Threads Module
 *
 * Thread CRUD and folder organization.
 * Depends on messages module for data lifecycle operations.
 */

import { defineModule } from '@main/kernel/module'
import type { ThreadPatch, ThreadEvent } from './business'
import {
  listThreads,
  executeDelete,
  executeUpdate,
  executeDuplicate,
  executeCreateFolder,
  executeCreateFolderWithThread,
  executeMoveToFolder,
  executeMoveToRoot,
  executeReorderInFolder,
} from './business'

type MessagesDep = {
  deleteData: (input: { threadId: string }) => Promise<void>
  duplicateData: (input: { sourceId: string; targetId: string; upToMessageId?: string }) => Promise<void>
}

const broadcastEvents = (events: ThreadEvent[], emit: (event: 'created' | 'updated' | 'deleted', data: unknown) => void) => {
  for (const e of events) {
    emit(e.type, e.type === 'deleted' ? e.id : e.thread)
  }
}

export default defineModule({
  capabilities: ['jsonFile', 'jsonLog', 'logger'] as const,
  depends: ['messages'] as const,
  provides: (deps, _caps, emit) => {
    const messages = deps.messages as MessagesDep

    return {
      list: () => listThreads(),

      update: async (input: { threadId: string; patch: ThreadPatch }) => {
        const { result, events } = await executeUpdate(input.threadId, input.patch)
        broadcastEvents(events, emit)
        return result
      },

      delete: async (input: { threadId: string }) => {
        const { events } = await executeDelete(messages, input.threadId)
        broadcastEvents(events, emit)
      },

      duplicate: async (input: { threadId: string; upToMessageId?: string }) => {
        const { result, events } = await executeDuplicate(messages, input.threadId, input.upToMessageId)
        broadcastEvents(events, emit)
        return result
      },

      createFolder: async (input: { name: string; threadId1: string; threadId2: string }) => {
        const { result, events } = await executeCreateFolder(input.name, [input.threadId1, input.threadId2])
        broadcastEvents(events, emit)
        return result
      },

      createFolderWithThread: async (input: { threadId: string }) => {
        const { result, events } = await executeCreateFolderWithThread(input.threadId)
        broadcastEvents(events, emit)
        return result
      },

      moveToFolder: async (input: { threadId: string; folderId: string }) => {
        const { events } = await executeMoveToFolder(input.threadId, input.folderId)
        broadcastEvents(events, emit)
      },

      moveToRoot: async (input: { threadId: string }) => {
        const { events } = await executeMoveToRoot(input.threadId)
        broadcastEvents(events, emit)
      },

      reorderInFolder: async (input: { folderId: string; orderedChildIds: string[] }) => {
        const { events } = await executeReorderInFolder(input.folderId, input.orderedChildIds)
        broadcastEvents(events, emit)
      },
    }
  },
  emits: ['created', 'updated', 'deleted'] as const,
  paths: ['app/messages/'],
})
