/**
 * Messages Business Logic
 *
 * Pure domain logic + cap-orchestrated operations.
 * Zero knowledge of persistence format, paths, or Foundation.
 * Receives capabilities as parameters.
 */

import { createId } from '@paralleldrive/cuid2'
import type { StoredAttachment, StoredMessageEvent, Usage } from './json-log'
import type jsonLogAdapter from './json-log'
import type binaryFileAdapter from './binary-file'

// Re-export types for external consumers (source is json-log cap)
export type { StoredAttachment, StoredMessageEvent, Usage } from './json-log'

// ============================================================================
// TYPES
// ============================================================================

export type MessageRole = 'user' | 'assistant' | 'system'

export type BranchInfo = {
  parentId: string | null
  branches: string[]
  currentIndex: number
}

export type AttachmentInput = {
  type: 'image'
  data: string
  mimeType: string
  name?: string
}

interface BaseMessageFields {
  content: string
  model: string
  provider: string
  attachments?: AttachmentInput[]
  reasoning?: string
  usage?: Usage
}

export type AppendMessageInput =
  | (BaseMessageFields & {
      type: 'new'
      role: MessageRole
      parentId: string | null
    })
  | (BaseMessageFields & { type: 'edit'; messageId: string })

export interface ReadMessagesResult {
  messages: StoredMessageEvent[]
  branchPoints: BranchInfo[]
}

type JsonLogCap = ReturnType<typeof jsonLogAdapter.factory>
type BinaryFileCap = ReturnType<typeof binaryFileAdapter.factory>

// ============================================================================
// REDUCER (pure)
// ============================================================================

function computeBranchPoints(childrenMap: Map<string | null, string[]>): BranchInfo[] {
  const branchPoints: BranchInfo[] = []
  for (const [parentId, children] of childrenMap.entries()) {
    if (children.length > 1) {
      branchPoints.push({ parentId, branches: children, currentIndex: 0 })
    }
  }
  return branchPoints
}

export function reduceMessageEvents(events: StoredMessageEvent[]): ReadMessagesResult {
  const messagesById = new Map<string, StoredMessageEvent>()
  for (const event of events) {
    const existing = messagesById.get(event.id)
    if (existing) {
      messagesById.set(event.id, { ...existing, ...event })
    } else {
      messagesById.set(event.id, { ...event })
    }
  }

  const validMessages = Array.from(messagesById.values()).filter((msg) => !msg.deleted)

  const childrenMap = new Map<string | null, string[]>()
  for (const msg of validMessages) {
    const parentId = msg.parentId ?? null
    if (!childrenMap.has(parentId)) {
      childrenMap.set(parentId, [])
    }
    childrenMap.get(parentId)!.push(msg.id)
  }

  for (const [, childIds] of childrenMap.entries()) {
    childIds.sort((a, b) => {
      const msgA = messagesById.get(a)
      const msgB = messagesById.get(b)
      const timeA = msgA?.createdAt ? new Date(msgA.createdAt).getTime() : 0
      const timeB = msgB?.createdAt ? new Date(msgB.createdAt).getTime() : 0
      return timeA - timeB
    })
  }

  return { messages: validMessages, branchPoints: computeBranchPoints(childrenMap) }
}

// ============================================================================
// EVENT BUILDER (pure)
// ============================================================================

function buildMessageEvent(
  input: AppendMessageInput,
  buildFilename: (messageId: string, index: number, mimeType: string) => string,
): { event: StoredMessageEvent; attachmentMeta: StoredAttachment[] | undefined } {
  const isNew = input.type === 'new'
  const id = isNew ? createId() : input.messageId
  const timestamp = new Date().toISOString()

  const attachmentMeta: StoredAttachment[] | undefined = input.attachments?.length
    ? input.attachments.map((att, i) => ({
        type: 'image' as const,
        path: buildFilename(id, i, att.mimeType),
        mimeType: att.mimeType,
      }))
    : undefined

  const event: StoredMessageEvent = {
    id,
    content: input.content,
    model: input.model,
    provider: input.provider,
    reasoning: input.reasoning,
    usage: input.usage,
    attachments: attachmentMeta,
    ...(isNew
      ? { role: input.role, parentId: input.parentId, createdAt: timestamp }
      : { updatedAt: timestamp }),
  }

  return { event, attachmentMeta }
}

// ============================================================================
// CAP-ORCHESTRATED OPERATIONS
// ============================================================================

/**
 * Appends a message event + writes attachments.
 * Effect ordering: log append → attachment writes.
 */
export async function appendMessage(
  jsonLog: JsonLogCap,
  binaryFile: BinaryFileCap,
  threadId: string,
  input: AppendMessageInput,
) {
  const { event, attachmentMeta } = buildMessageEvent(input, binaryFile.buildFilename)

  await jsonLog.append(threadId, event)

  if (input.attachments?.length && attachmentMeta) {
    await Promise.all(
      input.attachments.map((att, i) =>
        binaryFile.write(threadId, attachmentMeta[i].path, att.data),
      ),
    )
  }

  return event
}

/** Reads events and reduces to messages + branch points. */
export async function readMessages(jsonLog: JsonLogCap, threadId: string) {
  const events = await jsonLog.read(threadId)
  return reduceMessageEvents(events)
}

/** Deletes message log + attachments for a thread. */
export async function deleteThreadData(jsonLog: JsonLogCap, binaryFile: BinaryFileCap, threadId: string) {
  await jsonLog.delete(threadId)
  await binaryFile.deleteAll(threadId)
}

/** Copies message log + attachments from source to target. */
export async function copyThreadData(
  jsonLog: JsonLogCap,
  binaryFile: BinaryFileCap,
  sourceId: string,
  targetId: string,
  upToMessageId?: string,
) {
  if (upToMessageId) {
    const events = await jsonLog.read(sourceId)
    const { filtered, attachmentPaths } = filterAncestry(events, upToMessageId)

    for (const event of filtered) {
      await jsonLog.append(targetId, event)
    }

    if (attachmentPaths.length > 0) {
      await binaryFile.copySelective(sourceId, targetId, attachmentPaths)
    }
  } else {
    const events = await jsonLog.read(sourceId)
    for (const event of events) {
      await jsonLog.append(targetId, event)
    }
    await binaryFile.copyAll(sourceId, targetId)
  }
}

// ============================================================================
// ANCESTRY FILTER (pure)
// ============================================================================

function filterAncestry(
  events: StoredMessageEvent[],
  upToMessageId: string,
): { filtered: StoredMessageEvent[]; attachmentPaths: string[] } {
  const { messages } = reduceMessageEvents(events)

  const target = messages.find((m) => m.id === upToMessageId)
  if (!target) throw new Error(`Message not found: ${upToMessageId}`)

  const ancestryIds = new Set<string>()
  let current: StoredMessageEvent | undefined = target

  while (current) {
    ancestryIds.add(current.id)
    current = current.parentId ? messages.find((m) => m.id === current!.parentId) : undefined
  }

  const filtered = events.filter((e) => ancestryIds.has(e.id))

  const attachmentPaths: string[] = []
  for (const event of filtered) {
    if (event.attachments) {
      for (const att of event.attachments) {
        attachmentPaths.push(att.path)
      }
    }
  }

  return { filtered, attachmentPaths }
}
