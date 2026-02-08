/**
 * Messages Business Logic
 *
 * Pure domain logic + cap-orchestrated operations.
 * Zero knowledge of persistence format, paths, or Foundation.
 * Receives capabilities as parameters.
 */

import { createId } from '@paralleldrive/cuid2'

// ============================================================================
// REDUCER (pure)
// ============================================================================

function computeBranchPoints(childrenMap) {
  const branchPoints = []
  for (const [parentId, children] of childrenMap.entries()) {
    if (children.length > 1) {
      branchPoints.push({ parentId, branches: children, currentIndex: 0 })
    }
  }
  return branchPoints
}

export function reduceMessageEvents(events) {
  const messagesById = new Map()
  for (const event of events) {
    const existing = messagesById.get(event.id)
    if (existing) {
      messagesById.set(event.id, { ...existing, ...event })
    } else {
      messagesById.set(event.id, { ...event })
    }
  }

  const validMessages = Array.from(messagesById.values()).filter((msg) => !msg.deleted)

  const childrenMap = new Map()
  for (const msg of validMessages) {
    const parentId = msg.parentId ?? null
    if (!childrenMap.has(parentId)) {
      childrenMap.set(parentId, [])
    }
    childrenMap.get(parentId).push(msg.id)
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
  input,
  buildFilename,
) {
  const isNew = input.type === 'new'
  const id = isNew ? createId() : input.messageId
  const timestamp = new Date().toISOString()

  const attachmentMeta = input.attachments?.length
    ? input.attachments.map((att, i) => ({
        type: 'image',
        path: buildFilename(id, i, att.mimeType),
        mimeType: att.mimeType,
      }))
    : undefined

  const event = {
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
  jsonLog,
  binaryFile,
  threadId,
  input,
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
export async function readMessages(jsonLog, threadId) {
  const events = await jsonLog.read(threadId)
  return reduceMessageEvents(events)
}

/** Deletes message log + attachments for a thread. */
export async function deleteThreadData(jsonLog, binaryFile, threadId) {
  await jsonLog.delete(threadId)
  await binaryFile.deleteAll(threadId)
}

/** Copies message log + attachments from source to target. */
export async function copyThreadData(
  jsonLog,
  binaryFile,
  sourceId,
  targetId,
  upToMessageId,
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
    await jsonLog.copy(sourceId, targetId)
    await binaryFile.copyAll(sourceId, targetId)
  }
}

// ============================================================================
// ANCESTRY FILTER (pure)
// ============================================================================

function filterAncestry(
  events,
  upToMessageId,
) {
  const { messages } = reduceMessageEvents(events)

  const target = messages.find((m) => m.id === upToMessageId)
  if (!target) throw new Error(`Message not found: ${upToMessageId}`)

  const ancestryIds = new Set()
  let current = target

  while (current) {
    ancestryIds.add(current.id)
    current = current.parentId ? messages.find((m) => m.id === current.parentId) : undefined
  }

  const filtered = events.filter((e) => ancestryIds.has(e.id))

  const attachmentPaths = []
  for (const event of filtered) {
    if (event.attachments) {
      for (const att of event.attachments) {
        attachmentPaths.push(att.path)
      }
    }
  }

  return { filtered, attachmentPaths }
}

function walkAncestry(messages, leafMessageId, threadId) {
  const target = messages.find((m) => m.id === leafMessageId)
  if (!target) throw new Error(`Message ${leafMessageId} not found in thread ${threadId}`)

  const ancestry = []
  let current = target

  while (current) {
    ancestry.unshift(current)
    current = current.parentId ? messages.find((m) => m.id === current.parentId) : undefined
  }

  return ancestry
}

// ============================================================================
// CONVERSATION FOR AI STREAMING
// ============================================================================

export async function getConversation(
  jsonLog,
  binaryFile,
  threadId,
  leafMessageId,
) {
  const events = await jsonLog.read(threadId)
  const { messages } = reduceMessageEvents(events)
  const ancestry = walkAncestry(messages, leafMessageId, threadId)

  return Promise.all(
    ancestry.map(async (message) => {
      if (message.role === 'user' && message.attachments?.length) {
        const imageParts = await Promise.all(
          message.attachments.map(async (att) => {
            const buffer = await binaryFile.read(threadId, att.path)
            if (!buffer) return null
            const base64 = buffer.toString('base64')
            return {
              type: 'image',
              image: `data:${att.mimeType};base64,${base64}`,
              mediaType: att.mimeType,
            }
          }),
        )
        const validParts = imageParts.filter((p) => p !== null)
        // content! — AppendMessageInput requires content; all persisted messages have it
        const content = [...validParts, { type: 'text', text: message.content }]
        return { role: 'user', content }
      }

      // content! — AppendMessageInput requires content; all persisted messages have it
      return {
        role: message.role,
        content: message.content,
      }
    }),
  )
}
