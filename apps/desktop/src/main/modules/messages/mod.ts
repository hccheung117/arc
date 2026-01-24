/**
 * Messages Module
 *
 * Message CRUD, branching, and thread data lifecycle.
 * Auto-creates threads on first message via emit.
 */

import { defineModule } from '@main/kernel/module'
import type { AppendMessageInput } from './business'
import {
  readMessages,
  appendMessage,
  deleteThreadData,
  copyThreadData,
  threadStorage,
  findById,
} from './business'

export default defineModule({
  capabilities: ['jsonLog', 'jsonFile', 'logger'] as const,
  depends: [] as const,
  provides: (_deps, _caps, emit) => ({
    list: (input: { threadId: string }) => readMessages(input.threadId),

    create: async (input: { threadId: string; input: Omit<Extract<AppendMessageInput, { type: 'new' }>, 'type' | 'threadId'> }) => {
      const { message, threadCreated } = await appendMessage({
        type: 'new',
        threadId: input.threadId,
        ...input.input,
      })

      if (threadCreated) {
        const index = await threadStorage.read()
        const thread = findById(index.threads, input.threadId)
        if (thread) emit('threadCreated', thread)
      }

      return message
    },

    createBranch: async (input: { threadId: string; input: Omit<Extract<AppendMessageInput, { type: 'new' }>, 'type' | 'threadId' | 'role'> }) => {
      const { message } = await appendMessage({
        type: 'new',
        threadId: input.threadId,
        role: 'user',
        ...input.input,
      })

      const { branchPoints } = await readMessages(input.threadId)
      return { message, branchPoints }
    },

    update: async (input: { threadId: string; messageId: string; input: Omit<Extract<AppendMessageInput, { type: 'edit' }>, 'type' | 'threadId' | 'messageId'> }) => {
      const { message } = await appendMessage({
        type: 'edit',
        threadId: input.threadId,
        messageId: input.messageId,
        ...input.input,
      })
      return message
    },

    duplicateData: (input: { sourceId: string; targetId: string; upToMessageId?: string }) =>
      copyThreadData(input.sourceId, input.targetId, input.upToMessageId),

    deleteData: (input: { threadId: string }) =>
      deleteThreadData(input.threadId),
  }),
  emits: ['threadCreated'] as const,
  paths: ['app/messages/'],
})
