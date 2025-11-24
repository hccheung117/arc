import { createId } from '@paralleldrive/cuid2'
import type { Message, MessageRole } from '@arc-types/messages'
import {
  messageLogFile,
  threadIndexFile,
  reduceMessageEvents,
  type StoredMessageEvent,
} from '@main/storage'

/**
 * Converts a StoredMessageEvent to a Message entity.
 * Hydrates default fields (status, conversationId) that are not stored on disk.
 */
export function toMessage(event: StoredMessageEvent, conversationId: string): Message {
  return {
    id: event.id,
    conversationId,
    role: event.role!,
    status: 'complete', // All persisted messages are complete
    content: event.content!,
    createdAt: event.createdAt!,
    updatedAt: event.updatedAt ?? event.createdAt!,
  }
}

/**
 * Returns all messages for a conversation by reading and reducing the event log.
 * Implements event sourcing: the log is the source of truth.
 */
export async function getMessages(conversationId: string): Promise<Message[]> {
  const events = await messageLogFile(conversationId).read()
  const reducedEvents = reduceMessageEvents(events)
  return reducedEvents.map((event) => toMessage(event, conversationId))
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
  input: { role: MessageRole; content: string },
): Promise<{ message: Message; threadWasCreated: boolean }> {
  const now = new Date().toISOString()
  const messageId = createId()

  // Create the message event
  const event: StoredMessageEvent = {
    id: messageId,
    role: input.role,
    content: input.content,
    createdAt: now,
  }

  // Append to message log (creates file if doesn't exist)
  await messageLogFile(conversationId).append(event)

  // Lazily create thread in index if this is the first message
  let wasCreated = false
  await threadIndexFile().update((index) => {
    const existingThread = index.threads.find((t) => t.id === conversationId)

    if (!existingThread) {
      // First message: create new thread entry
      index.threads.push({
        id: conversationId,
        title: null, // Will be auto-generated from first message
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

  const message = toMessage(event, conversationId)
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
): Promise<Message> {
  const now = new Date().toISOString()
  const messageId = createId()

  // Create the message event
  const event: StoredMessageEvent = {
    id: messageId,
    role: 'assistant',
    content,
    createdAt: now,
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

  return toMessage(event, conversationId)
}
