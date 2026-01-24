/**
 * Messages Module
 *
 * Message CRUD, branching, and data lifecycle.
 * Pure module with zero dependencies — thread management is handled by threads module.
 */

import { defineModule } from '@main/kernel/module'
import type jsonLogAdapter from './json-log'
import type binaryFileAdapter from './binary-file'
import type loggerAdapter from './logger'
import {
  appendMessage,
  readMessages,
  deleteThreadData,
  copyThreadData,
  type AppendMessageInput,
} from './business'

type Caps = {
  jsonLog: ReturnType<typeof jsonLogAdapter.factory>
  binaryFile: ReturnType<typeof binaryFileAdapter.factory>
  logger: ReturnType<typeof loggerAdapter.factory>
}

export default defineModule({
  capabilities: ['jsonLog', 'binaryFile', 'logger'] as const,
  depends: [] as const,
  provides: (_deps, caps: Caps) => ({
    list: (input: { threadId: string }) =>
      readMessages(caps.jsonLog, input.threadId),

    create: (input: { threadId: string; input: Omit<Extract<AppendMessageInput, { type: 'new' }>, 'type'> }) =>
      appendMessage(caps.jsonLog, caps.binaryFile, input.threadId, { type: 'new', ...input.input }),

    createBranch: async (input: { threadId: string; input: Omit<Extract<AppendMessageInput, { type: 'new' }>, 'type' | 'role'> }) => {
      const message = await appendMessage(caps.jsonLog, caps.binaryFile, input.threadId, { type: 'new', role: 'user', ...input.input })
      const { branchPoints } = await readMessages(caps.jsonLog, input.threadId)
      return { message, branchPoints }
    },

    update: (input: { threadId: string; messageId: string; input: Omit<Extract<AppendMessageInput, { type: 'edit' }>, 'type' | 'messageId'> }) =>
      appendMessage(caps.jsonLog, caps.binaryFile, input.threadId, { type: 'edit', messageId: input.messageId, ...input.input }),

    duplicateData: (input: { sourceId: string; targetId: string; upToMessageId?: string }) =>
      copyThreadData(caps.jsonLog, caps.binaryFile, input.sourceId, input.targetId, input.upToMessageId),

    deleteData: (input: { threadId: string }) =>
      deleteThreadData(caps.jsonLog, caps.binaryFile, input.threadId),

    readAttachment: (input: { threadId: string; filename: string }) =>
      caps.binaryFile.read(input.threadId, input.filename),
  }),
  emits: [] as const,
  paths: ['app/messages/'],
})
