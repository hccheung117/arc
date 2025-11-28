import { createId } from '@paralleldrive/cuid2'
import type { Message, MessageRole, MessageAttachment } from '@arc-types/messages'
import type { AttachmentInput } from '@arc-types/arc-api'
import {
  messageLogFile,
  threadIndexFile,
  reduceMessageEvents,
  type StoredMessageEvent,
  type StoredAttachment,
} from '@main/storage'
import { writeAttachment, readAttachment } from './attachments'

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
  // Hydrate attachments with data URLs
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
    status: 'complete', // All persisted messages are complete
    content: event.content!,
    createdAt: event.createdAt!,
    updatedAt: event.updatedAt ?? event.createdAt!,
    attachments,
  }
}

/**
 * Returns all messages for a conversation by reading and reducing the event log.
 * Implements event sourcing: the log is the source of truth.
 */
export async function getMessages(conversationId: string): Promise<Message[]> {
  const events = await messageLogFile(conversationId).read()
  const reducedEvents = reduceMessageEvents(events)
  return Promise.all(reducedEvents.map((event) => toMessage(event, conversationId)))
}

/**
 * Creates a new message by appending to the event log.
 * Implements lazy thread creation: adds thread to index on first message.
 *
 * This is the critical "message-first" operation that drives the entire system.
 *
 * @returns Object with message and wasCreated flag for event emission
 */
export async function createMessage(
  conversationId: string,
  input: { role: MessageRole; content: string; attachments?: AttachmentInput[]; modelId: string; providerId: string },
): Promise<{ message: Message; threadWasCreated: boolean }> {
  const now = new Date().toISOString()
  const messageId = createId()

  // Write attachments to disk and collect stored references
  let storedAttachments: StoredAttachment[] | undefined
  if (input.attachments?.length) {
    storedAttachments = await Promise.all(
      input.attachments.map((att, index) =>
        writeAttachment(conversationId, messageId, index, att.data, att.mimeType),
      ),
    )
  }

  // Create the message event
  const event: StoredMessageEvent = {
    id: messageId,
    role: input.role,
    content: input.content,
    createdAt: now,
    attachments: storedAttachments,
    modelId: input.modelId,
    providerId: input.providerId,
  }

  // Append to message log (creates file if doesn't exist)
  await messageLogFile(conversationId).append(event)

  // Lazily create thread in index if this is the first message
  let wasCreated = false
  await threadIndexFile().update((index) => {
    const existingThread = index.threads.find((t) => t.id === conversationId)

    if (!existingThread) {
      // First message: create new thread entry with title from user message
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
      // Existing thread: update timestamp
      existingThread.updatedAt = now
    }

    return index
  })

  const message = await toMessage(event, conversationId)
  return { message, threadWasCreated: wasCreated }
}

/**
 * Inserts an assistant message by appending to the event log.
 * Called after AI streaming completes.
 *
 * Note: This function is only called when the stream is complete, ensuring
 * that only full, valid responses are persisted.
 */
export async function insertAssistantMessage(
  conversationId: string,
  content: string,
  modelId: string,
  providerId: string,
): Promise<Message> {
  const now = new Date().toISOString()
  const messageId = createId()

  // Create the message event
  const event: StoredMessageEvent = {
    id: messageId,
    role: 'assistant',
    content,
    createdAt: now,
    modelId,
    providerId,
  }

  // Append to message log
  await messageLogFile(conversationId).append(event)

  // Update thread timestamp in index
  await threadIndexFile().update((index) => {
    const thread = index.threads.find((t) => t.id === conversationId)
    if (thread) {
      thread.updatedAt = now
    }
    return index
  })

  return await toMessage(event, conversationId)
}
