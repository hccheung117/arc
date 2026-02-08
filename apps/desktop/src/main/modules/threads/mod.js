/**
 * Threads Module
 *
 * Thread CRUD and folder organization.
 * Depends on messages module for data lifecycle operations.
 */

import { defineModule } from '@main/kernel/module'
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

const broadcastEvents = (events, emit) => {
  for (const e of events) {
    emit(e.type, e.type === 'deleted' ? e.id : e.thread)
  }
}

export default defineModule({
  capabilities: ['jsonFile'],
  depends: ['messages'],
  provides: (deps, caps, emit) => {
    const storage = caps.jsonFile
    const messages = deps.messages

    return {
      list: () => listThreads(storage),

      create: async (input) => {
        const { result, events } = await executeCreate(storage, input.threadId, input.config)
        broadcastEvents(events, emit)
        return result
      },

      update: async (input) => {
        const { result, events } = await executeUpdate(storage, input.threadId, input.patch)
        broadcastEvents(events, emit)
        return result
      },

      delete: async (input) => {
        const { events } = await executeDelete(storage, messages, input.threadId)
        broadcastEvents(events, emit)
      },

      duplicate: async (input) => {
        const { result, events } = await executeDuplicate(storage, messages, input.threadId, input.upToMessageId)
        broadcastEvents(events, emit)
        return result
      },

      folderThreads: async (input) => {
        const { result, events } = await executeFolderThreads(storage, input.threadIds, input.name)
        broadcastEvents(events, emit)
        return result
      },

      moveToFolder: async (input) => {
        const { events } = await executeMoveToFolder(storage, input.threadId, input.folderId)
        broadcastEvents(events, emit)
      },

      moveToRoot: async (input) => {
        const { events } = await executeMoveToRoot(storage, input.threadId)
        broadcastEvents(events, emit)
      },

      reorderInFolder: async (input) => {
        const { events } = await executeReorderInFolder(storage, input.folderId, input.orderedChildIds)
        broadcastEvents(events, emit)
      },
    }
  },
  emits: ['created', 'updated', 'deleted'],
  paths: ['app/messages/'],
})
