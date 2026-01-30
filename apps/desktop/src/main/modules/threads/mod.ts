/**
 * Threads Module
 *
 * Thread CRUD and folder organization.
 * Depends on messages module for data lifecycle operations.
 */

import { defineModule } from '@main/kernel/module'
import type { ThreadPatch, ThreadEvent, MessagesDep } from './business'
import type jsonFileAdapter from './json-file'
import type { ThreadConfig } from './json-file'
import {
  listThreads,
  executeCreate,
  executeDelete,
  executeUpdate,
  executeDuplicate,
  executeFolderThreads,
  executeMoveToFolder,
  executeMoveToRoot,
  executeReorderInFolder,
} from './business'

type Caps = {
  jsonFile: ReturnType<typeof jsonFileAdapter.factory>
}

const broadcastEvents = (events: ThreadEvent[], emit: (event: 'created' | 'updated' | 'deleted', data: unknown) => void) => {
  for (const e of events) {
    emit(e.type, e.type === 'deleted' ? e.id : e.thread)
  }
}

export default defineModule({
  capabilities: ['jsonFile'] as const,
  depends: ['messages'] as const,
  provides: (deps, caps: Caps, emit) => {
    const storage = caps.jsonFile
    const messages = deps.messages as MessagesDep

    return {
      list: () => listThreads(storage),

      create: async (input: { threadId: string; config: ThreadConfig }) => {
        const { result, events } = await executeCreate(storage, input.threadId, input.config)
        broadcastEvents(events, emit)
        return result
      },

      update: async (input: { threadId: string; patch: ThreadPatch }) => {
        const { result, events } = await executeUpdate(storage, input.threadId, input.patch)
        broadcastEvents(events, emit)
        return result
      },

      delete: async (input: { threadId: string }) => {
        const { events } = await executeDelete(storage, messages, input.threadId)
        broadcastEvents(events, emit)
      },

      duplicate: async (input: { threadId: string; upToMessageId?: string }) => {
        const { result, events } = await executeDuplicate(storage, messages, input.threadId, input.upToMessageId)
        broadcastEvents(events, emit)
        return result
      },

      folderThreads: async (input: { threadIds: string[]; name?: string }) => {
        const { result, events } = await executeFolderThreads(storage, input.threadIds, input.name)
        broadcastEvents(events, emit)
        return result
      },

      moveToFolder: async (input: { threadId: string; folderId: string }) => {
        const { events } = await executeMoveToFolder(storage, input.threadId, input.folderId)
        broadcastEvents(events, emit)
      },

      moveToRoot: async (input: { threadId: string }) => {
        const { events } = await executeMoveToRoot(storage, input.threadId)
        broadcastEvents(events, emit)
      },

      reorderInFolder: async (input: { folderId: string; orderedChildIds: string[] }) => {
        const { events } = await executeReorderInFolder(storage, input.folderId, input.orderedChildIds)
        broadcastEvents(events, emit)
      },
    }
  },
  emits: ['created', 'updated', 'deleted'] as const,
  paths: ['app/messages/'],
})
