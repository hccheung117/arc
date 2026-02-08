/**
 * Messages Module
 *
 * Message CRUD, branching, and data lifecycle.
 * Pure module with zero dependencies — thread management is handled by threads module.
 */

import { defineModule } from '@main/kernel/module'
import {
  appendMessage,
  readMessages,
  deleteThreadData,
  copyThreadData,
  getConversation,
} from './business'

export default defineModule({
  capabilities: ['jsonLog', 'binaryFile', 'markdownFile'],
  depends: [],
  provides: (_deps, caps) => ({
    list: (input) =>
      readMessages(caps.jsonLog, input.threadId),

    create: (input) =>
      appendMessage(caps.jsonLog, caps.binaryFile, input.threadId, { type: 'new', ...input.input }),

    createBranch: async (input) => {
      const message = await appendMessage(caps.jsonLog, caps.binaryFile, input.threadId, { type: 'new', role: 'user', ...input.input })
      const { branchPoints } = await readMessages(caps.jsonLog, input.threadId)
      return { message, branchPoints }
    },

    update: (input) =>
      appendMessage(caps.jsonLog, caps.binaryFile, input.threadId, { type: 'edit', messageId: input.messageId, ...input.input }),

    duplicateData: (input) =>
      copyThreadData(caps.jsonLog, caps.binaryFile, input.sourceId, input.targetId, input.upToMessageId),

    deleteData: (input) =>
      deleteThreadData(caps.jsonLog, caps.binaryFile, input.threadId),

    readAttachment: (input) =>
      caps.binaryFile.read(input.threadId, input.filename),

    getAttachmentPath: (input) =>
      caps.binaryFile.getAbsolutePath(input.threadId, input.filename),

    export: async (input) => {
      const { messages } = await readMessages(caps.jsonLog, input.threadId)
      return caps.markdownFile.exportChat(messages)
    },

    getConversation: (input) =>
      getConversation(caps.jsonLog, caps.binaryFile, input.threadId, input.leafMessageId),
  }),
  emits: [],
  paths: ['app/messages/'],
})
