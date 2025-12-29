/**
 * Conversation & Message Management
 *
 * Handles all conversation data persistence:
 * - Thread CRUD (create, read, update, delete)
 * - Message operations with event sourcing
 * - Attachment file I/O
 *
 * Storage layout:
 * userData/arcfs/messages/
 * ├── {threadId}.jsonl          # Message log (event sourced)
 * ├── {threadId}/               # Attachments folder
 * │   ├── {messageId}-0.png
 * │   └── {messageId}-1.jpg
 */

import * as fs from 'fs/promises'
import { createId } from '@paralleldrive/cuid2'
import type { Message, MessageRole, MessageAttachment } from '@arc-types/messages'
import type { ConversationSummary } from '@arc-types/conversations'
import type { Conversation, ConversationPatch, AttachmentInput } from '@arc-types/arc-api'
import { messageLogFile, threadIndexFile, getThreadAttachmentsDir, getThreadAttachmentPath } from './storage'
import { reduceMessageEvents } from './reducer'
import type {
  StoredMessageEvent,
  StoredAttachment,
  StoredThread,
  BranchInfo,
  Usage,
} from './schemas'
import { broadcast } from '@main/foundation/ipc'

// ============================================================================
// CONVERSATION EVENTS
// ============================================================================

export type ConversationEvent =
  | { type: 'created'; conversation: { id: string; title: string; pinned: boolean; createdAt: string; updatedAt: string } }
  | { type: 'updated'; conversation: { id: string; title: string; pinned: boolean; createdAt: string; updatedAt: string } }
  | { type: 'deleted'; id: string }

export function emitConversationEvent(event: ConversationEvent): void {
  broadcast('arc:conversations:event', event)
}

// ============================================================================
// ATTACHMENT I/O
// ============================================================================

/**
 * Maps MIME type to file extension.
 */
function getExtension(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
  }
  return mimeToExt[mimeType] || 'png'
}

/**
 * Ensures the thread's attachment directory exists.
 */
async function ensureAttachmentsDir(threadId: string): Promise<void> {
  await fs.mkdir(getThreadAttachmentsDir(threadId), { recursive: true })
}

/**
 * Writes an attachment to disk.
 */
async function writeAttachment(
  threadId: string,
  messageId: string,
  index: number,
  data: string,
  mimeType: string,
): Promise<StoredAttachment> {
  await ensureAttachmentsDir(threadId)

  const ext = getExtension(mimeType)
  const filename = `${messageId}-${index}.${ext}`
  const relativePath = filename
  const absolutePath = getThreadAttachmentPath(threadId, filename)

  const buffer = Buffer.from(data, 'base64')
  await fs.writeFile(absolutePath, buffer)

  return {
    type: 'image',
    path: relativePath,
    mimeType,
  }
}

/**
 * Reads an attachment from disk and returns it as a data URL.
 */
async function readAttachment(
  threadId: string,
  relativePath: string,
  mimeType: string,
): Promise<string> {
  const absolutePath = getThreadAttachmentPath(threadId, relativePath)
  const buffer = await fs.readFile(absolutePath)
  const base64 = buffer.toString('base64')
  return `data:${mimeType};base64,${base64}`
}

/**
 * Deletes all attachments for a thread.
 */
async function deleteThreadAttachments(threadId: string): Promise<void> {
  try {
    await fs.rm(getThreadAttachmentsDir(threadId), { recursive: true, force: true })
  } catch {
    // Directory may not exist, ignore
  }
}

// ============================================================================
// CONVERSATION (THREAD) OPERATIONS
// ============================================================================

/**
 * Converts a StoredThread to a Conversation entity.
 */
export function toConversation(thread: StoredThread): Conversation {
  return {
    id: thread.id,
    title: thread.title ?? 'New Chat',
    pinned: thread.pinned,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
  }
}

/**
 * Returns all conversation summaries for the sidebar.
 * Threads are sorted by last update time (most recent first).
 */
export async function getConversationSummaries(): Promise<ConversationSummary[]> {
  const index = await threadIndexFile().read()

  const sortedThreads = [...index.threads].sort((a, b) => {
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })

  return sortedThreads.map((thread) => ({
    id: thread.id,
    updatedAt: thread.updatedAt,
    createdAt: thread.createdAt,
    pinned: thread.pinned,
    title: thread.title ?? 'New Chat',
  }))
}

/**
 * Updates a conversation with a partial patch.
 */
export async function updateConversation(
  id: string,
  patch: ConversationPatch,
): Promise<Conversation> {
  let updatedThread: StoredThread | undefined

  await threadIndexFile().update((index) => {
    const thread = index.threads.find((t) => t.id === id)
    if (!thread) {
      throw new Error(`Conversation not found: ${id}`)
    }

    const now = new Date().toISOString()
    if (patch.title !== undefined) {
      thread.title = patch.title
      thread.renamed = true
    }
    if (patch.pinned !== undefined) {
      thread.pinned = patch.pinned
    }
    thread.updatedAt = now

    updatedThread = thread
    return index
  })

  if (!updatedThread) {
    throw new Error(`Failed to update conversation: ${id}`)
  }

  return toConversation(updatedThread)
}

/**
 * Deletes a conversation and all its messages and attachments.
 */
export async function deleteConversation(conversationId: string): Promise<void> {
  await threadIndexFile().update((index) => {
    index.threads = index.threads.filter((t) => t.id !== conversationId)
    return index
  })

  await messageLogFile(conversationId).delete()
  await deleteThreadAttachments(conversationId)
}

/**
 * Renames a conversation by setting a custom title.
 * Marks the conversation as renamed so auto-generation doesn't override it.
 */
export async function renameConversation(conversationId: string, title: string): Promise<void> {
  await threadIndexFile().update((index) => {
    const thread = index.threads.find((t) => t.id === conversationId)
    if (!thread) {
      throw new Error(`Conversation not found: ${conversationId}`)
    }
    thread.title = title
    thread.renamed = true
    thread.updatedAt = new Date().toISOString()
    return index
  })
}

/**
 * Toggles the pinned status of a conversation.
 */
export async function toggleConversationPin(conversationId: string, pinned: boolean): Promise<void> {
  await threadIndexFile().update((index) => {
    const thread = index.threads.find((t) => t.id === conversationId)
    if (!thread) {
      throw new Error(`Conversation not found: ${conversationId}`)
    }
    thread.pinned = pinned
    thread.updatedAt = new Date().toISOString()
    return index
  })
}

// ============================================================================
// MESSAGE OPERATIONS
// ============================================================================

/**
 * Generates a title from message content.
 * Takes the first line, trimmed and truncated to 100 chars.
 */
function generateTitle(content: string): string {
  const firstLine = content.split('\n')[0].trim()
  if (!firstLine) return 'New Chat'
  return firstLine.length > 100 ? firstLine.slice(0, 100) : firstLine
}

/**
 * Hydrates a stored attachment with its data URL.
 */
async function hydrateAttachment(
  threadId: string,
  stored: StoredAttachment,
): Promise<MessageAttachment> {
  const url = await readAttachment(threadId, stored.path, stored.mimeType)
  return {
    type: stored.type,
    path: stored.path,
    mimeType: stored.mimeType,
    url,
  }
}

/**
 * Converts a StoredMessageEvent to a Message entity.
 * Hydrates default fields (status, conversationId) and attachment data URLs.
 */
export async function toMessage(
  event: StoredMessageEvent,
  conversationId: string,
): Promise<Message> {
  let attachments: MessageAttachment[] | undefined
  if (event.attachments?.length) {
    attachments = await Promise.all(
      event.attachments.map((att) => hydrateAttachment(conversationId, att)),
    )
  }

  return {
    id: event.id,
    conversationId,
    role: event.role!,
    status: 'complete',
    content: event.content!,
    reasoning: event.reasoning,
    createdAt: event.createdAt!,
    updatedAt: event.updatedAt ?? event.createdAt!,
    parentId: event.parentId ?? null,
    attachments,
    modelId: event.modelId,
    providerId: event.providerId,
  }
}

/**
 * Result of getMessages with branching support.
 */
export interface GetMessagesResult {
  messages: Message[]
  branchPoints: BranchInfo[]
}

/**
 * Returns messages along the active path with branch information.
 * Implements event sourcing: the log is the source of truth.
 */
export async function getMessages(conversationId: string): Promise<GetMessagesResult> {
  const events = await messageLogFile(conversationId).read()
  const { messages: reducedEvents, branchPoints } = reduceMessageEvents(events)
  const messages = await Promise.all(
    reducedEvents.map((event) => toMessage(event, conversationId)),
  )
  return { messages, branchPoints }
}

/**
 * Creates a new message by appending to the event log.
 * Implements lazy thread creation: adds thread to index on first message.
 */
export async function createMessage(
  conversationId: string,
  input: {
    role: MessageRole
    content: string
    parentId: string | null
    attachments?: AttachmentInput[]
    modelId: string
    providerId: string
  },
): Promise<{ message: Message; threadWasCreated: boolean }> {
  const now = new Date().toISOString()
  const messageId = createId()

  let storedAttachments: StoredAttachment[] | undefined
  if (input.attachments?.length) {
    storedAttachments = await Promise.all(
      input.attachments.map((att, index) =>
        writeAttachment(conversationId, messageId, index, att.data, att.mimeType),
      ),
    )
  }

  const event: StoredMessageEvent = {
    id: messageId,
    role: input.role,
    content: input.content,
    parentId: input.parentId,
    createdAt: now,
    attachments: storedAttachments,
    modelId: input.modelId,
    providerId: input.providerId,
  }

  await messageLogFile(conversationId).append(event)

  let wasCreated = false
  await threadIndexFile().update((index) => {
    const existingThread = index.threads.find((t) => t.id === conversationId)

    if (!existingThread) {
      index.threads.push({
        id: conversationId,
        title: input.role === 'user' ? generateTitle(input.content) : null,
        pinned: false,
        renamed: false,
        createdAt: now,
        updatedAt: now,
      })
      wasCreated = true
    } else {
      existingThread.updatedAt = now
    }

    return index
  })

  const message = await toMessage(event, conversationId)
  return { message, threadWasCreated: wasCreated }
}

/**
 * Inserts an assistant message by appending to the event log.
 * Called ONLY after AI streaming completes successfully.
 *
 * ATOMIC WRITE GUARANTEE:
 * This function writes a single JSONL line containing all message data.
 * We deliberately avoid writing partial data during streaming.
 */
export async function insertAssistantMessage(
  conversationId: string,
  content: string,
  reasoning: string | undefined,
  parentId: string | null,
  modelId: string,
  providerId: string,
  usage: Usage,
): Promise<Message> {
  const now = new Date().toISOString()
  const messageId = createId()

  const event: StoredMessageEvent = {
    id: messageId,
    role: 'assistant',
    content,
    reasoning,
    parentId,
    createdAt: now,
    modelId,
    providerId,
    usage,
  }

  await messageLogFile(conversationId).append(event)

  await threadIndexFile().update((index) => {
    const thread = index.threads.find((t) => t.id === conversationId)
    if (thread) {
      thread.updatedAt = now
    }
    return index
  })

  return await toMessage(event, conversationId)
}

/**
 * Result of createBranch operation.
 */
export interface CreateBranchResult {
  message: Message
  branchPoints: BranchInfo[]
}

/**
 * Creates a new branch by adding a message after a specific point.
 * Used for the "edit and regenerate" flow.
 */
export async function createBranch(
  conversationId: string,
  parentId: string | null,
  content: string,
  attachments: AttachmentInput[] | undefined,
  modelId: string,
  providerId: string,
): Promise<CreateBranchResult> {
  const now = new Date().toISOString()
  const messageId = createId()

  let storedAttachments: StoredAttachment[] | undefined
  if (attachments?.length) {
    storedAttachments = await Promise.all(
      attachments.map((att, index) =>
        writeAttachment(conversationId, messageId, index, att.data, att.mimeType),
      ),
    )
  }

  const event: StoredMessageEvent = {
    id: messageId,
    role: 'user',
    content,
    parentId,
    createdAt: now,
    attachments: storedAttachments,
    modelId,
    providerId,
  }
  await messageLogFile(conversationId).append(event)

  await threadIndexFile().update((index) => {
    const thread = index.threads.find((t) => t.id === conversationId)
    if (thread) {
      thread.updatedAt = now
    }
    return index
  })

  const message = await toMessage(event, conversationId)

  const updatedEvents = await messageLogFile(conversationId).read()
  const { branchPoints: updatedBranchPoints } = reduceMessageEvents(updatedEvents)

  return { message, branchPoints: updatedBranchPoints }
}

/**
 * Updates an existing message's content.
 * Uses event sourcing: appends a partial event that gets merged by reduceMessageEvents.
 */
export async function updateMessage(
  conversationId: string,
  messageId: string,
  content: string,
): Promise<Message> {
  const now = new Date().toISOString()

  const event: StoredMessageEvent = {
    id: messageId,
    content,
    updatedAt: now,
  }
  await messageLogFile(conversationId).append(event)

  await threadIndexFile().update((index) => {
    const thread = index.threads.find((t) => t.id === conversationId)
    if (thread) {
      thread.updatedAt = now
    }
    return index
  })

  const { messages } = await getMessages(conversationId)
  const updated = messages.find((m) => m.id === messageId)
  if (!updated) {
    throw new Error(`Message ${messageId} not found after update`)
  }
  return updated
}
