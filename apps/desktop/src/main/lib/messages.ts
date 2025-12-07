import { createId } from '@paralleldrive/cuid2'
import type { NormalizedUsage } from './openai-types'
import type { Message, MessageRole, MessageAttachment } from '@arc-types/messages'
import type { AttachmentInput } from '@arc-types/arc-api'
import {
  messageLogFile,
  threadIndexFile,
  reduceMessageEvents,
  type StoredMessageEvent,
  type StoredAttachment,
  type BranchInfo,
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
    reasoning: event.reasoning,
    createdAt: event.createdAt!,
    updatedAt: event.updatedAt ?? event.createdAt!,
    parentId: event.parentId,
    attachments,
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
 *
 * This is the critical "message-first" operation that drives the entire system.
 *
 * @returns Object with message and wasCreated flag for event emission
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
    parentId: input.parentId,
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
 * Called ONLY after AI streaming completes successfully.
 *
 * ATOMIC WRITE GUARANTEE:
 * ----------------------
 * This function writes a single JSONL line containing all message data:
 * - content: The full response text
 * - reasoning: The full thinking/reasoning (if present)
 * - usage: Token counts from the AI SDK
 *
 * We deliberately avoid writing partial data during streaming. If the stream
 * fails or the app crashes mid-generation, no incomplete message is persisted.
 * This ensures users never see a message with reasoning but no answer.
 *
 * The transactional pattern:
 * 1. User message → persisted immediately (never lose user input)
 * 2. AI streaming → memory only (ephemeral UI deltas)
 * 3. AI complete → single atomic write (this function)
 */
export async function insertAssistantMessage(
  conversationId: string,
  content: string,
  reasoning: string | undefined,
  parentId: string | null,
  modelId: string,
  providerId: string,
  usage: NormalizedUsage,
): Promise<Message> {
  const now = new Date().toISOString()
  const messageId = createId()

  // Create the message event
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

/**
 * Result of createBranch operation.
 */
export interface CreateBranchResult {
  message: Message
  branchPoints: BranchInfo[]
}

/**
 * Creates a new branch by adding a message after a specific point.
 * Used for the "edit and regenerate" flow - preserves old conversation, creates new branch.
 *
 * @param conversationId - The thread ID
 * @param parentId - The message to branch from (null for root)
 * @param content - Content for the new message
 * @param attachments - Optional attachments
 * @param modelId - Model ID for the message
 * @param providerId - Provider ID for the message
 * @returns The new message and updated branch points
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

  // Write attachments if provided
  let storedAttachments: StoredAttachment[] | undefined
  if (attachments?.length) {
    storedAttachments = await Promise.all(
      attachments.map((att, index) =>
        writeAttachment(conversationId, messageId, index, att.data, att.mimeType),
      ),
    )
  }

  // Create new message event with parentId
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

  // Update thread timestamp
  await threadIndexFile().update((index) => {
    const thread = index.threads.find((t) => t.id === conversationId)
    if (thread) {
      thread.updatedAt = now
    }
    return index
  })

  const message = await toMessage(event, conversationId)

  // Re-read to get updated branch points
  const updatedEvents = await messageLogFile(conversationId).read()
  const { branchPoints: updatedBranchPoints } = reduceMessageEvents(updatedEvents)

  return { message, branchPoints: updatedBranchPoints }
}
