/**
 * Message Operations
 *
 * Composable message operations using event sourcing.
 * Pure builders + minimal effectful functions.
 */

import { createId } from '@paralleldrive/cuid2'
import type { AttachmentInput, BranchInfo, ThreadConfig } from '@main/contracts/messages'
import type { StoredMessageEvent, StoredThread, StoredAttachment, Usage } from './schemas'
import { reduceMessageEvents } from './reducer'
import { threadIndexFile, messageLogFile, buildAttachment, writeAttachmentData } from './storage'
import { findById, updateById } from './tree'

// ============================================================================
// PURE BUILDERS
// ============================================================================

const now = () => new Date().toISOString()

const generateTitle = (content: string): string => {
  const firstLine = content.split('\n')[0].trim()
  if (!firstLine) return 'New Chat'
  return firstLine.length > 100 ? firstLine.slice(0, 100) : firstLine
}

const buildThread = (
  id: string,
  timestamp: string,
  title: string | null,
  config?: ThreadConfig,
): StoredThread => ({
  id,
  title,
  pinned: false,
  renamed: false,
  systemPrompt: config?.systemPrompt ?? null,
  createdAt: timestamp,
  updatedAt: timestamp,
  children: [],
})

// ============================================================================
// THREAD EFFECTS (composable)
// ============================================================================

type ThreadEffect = (threadId: string, timestamp: string) => Promise<boolean>

/** Touches thread timestamp. Returns false (no thread created). */
const touchThread: ThreadEffect = async (threadId, timestamp) => {
  await threadIndexFile().update((index) => ({
    threads: updateById(index.threads, threadId, (t) => ({ ...t, updatedAt: timestamp })),
  }))
  return false
}

/** Creates thread if missing, otherwise touches. Returns true if created. */
const ensureThread =
  (title: string | null, config?: ThreadConfig): ThreadEffect =>
  async (threadId, timestamp) => {
    let created = false
    await threadIndexFile().update((index) => {
      const exists = findById(index.threads, threadId) !== undefined
      if (exists) {
        return {
          threads: updateById(index.threads, threadId, (t) => ({ ...t, updatedAt: timestamp })),
        }
      }
      created = true
      return { threads: [...index.threads, buildThread(threadId, timestamp, title, config)] }
    })
    return created
  }

// ============================================================================
// CORE: APPEND EVENT
// ============================================================================

/**
 * Appends an event to the message log with thread side effect.
 * The single effectful primitive—everything else composes on top.
 */
async function appendEventToLog(
  threadId: string,
  event: StoredMessageEvent,
  threadEffect: ThreadEffect,
): Promise<{ event: StoredMessageEvent; threadCreated: boolean }> {
  const timestamp = event.createdAt ?? event.updatedAt ?? now()
  await messageLogFile(threadId).append(event)
  const threadCreated = await threadEffect(threadId, timestamp)
  return { event, threadCreated }
}

// ============================================================================
// PUBLIC API
// ============================================================================

interface BaseMessageFields {
  threadId: string
  content: string
  modelId: string
  providerId: string
  attachments?: AttachmentInput[]
  reasoning?: string
  usage?: Usage
}

export type AppendMessageInput =
  | (BaseMessageFields & {
      type: 'new'
      role: 'user' | 'assistant' | 'system'
      parentId: string | null
      threadConfig?: ThreadConfig
    })
  | (BaseMessageFields & { type: 'edit'; messageId: string })

export interface AppendMessageResult {
  message: StoredMessageEvent
  threadCreated: boolean
}

/**
 * Appends a message event to the log.
 *
 * - type: 'new' → creates message with new ID, may create thread
 * - type: 'edit' → appends edit event for existing message, touches thread
 *
 * Effect ordering: log append (source of truth) → thread index → attachment data.
 * If attachment writes fail, the log entry and thread exist—recoverable state.
 */
export async function appendMessage(input: AppendMessageInput): Promise<AppendMessageResult> {
  const isNew = input.type === 'new'
  const id = isNew ? createId() : input.messageId
  const timestamp = now()

  // Build attachment metadata (pure—no disk writes yet)
  const attachments: StoredAttachment[] | undefined = input.attachments?.length
    ? input.attachments.map((att, i) => buildAttachment(id, i, att.mimeType))
    : undefined

  const event: StoredMessageEvent = {
    id,
    content: input.content,
    modelId: input.modelId,
    providerId: input.providerId,
    reasoning: input.reasoning,
    usage: input.usage,
    attachments,
    ...(isNew
      ? { role: input.role, parentId: input.parentId, createdAt: timestamp }
      : { updatedAt: timestamp }),
  }

  const title = isNew && input.role === 'user' ? generateTitle(input.content) : null
  const config = isNew && input.type === 'new' ? input.threadConfig : undefined
  const threadEffect = isNew ? ensureThread(title, config) : touchThread

  // 1. Append to log first (source of truth)
  const result = await appendEventToLog(input.threadId, event, threadEffect)

  // 2. Write attachment data after log is committed
  if (input.attachments?.length && attachments) {
    await Promise.all(
      input.attachments.map((att, i) =>
        writeAttachmentData(input.threadId, attachments[i].path, att.data),
      ),
    )
  }

  return { message: result.event, threadCreated: result.threadCreated }
}

// ============================================================================
// READ
// ============================================================================

export interface ReadMessagesResult {
  messages: StoredMessageEvent[]
  branchPoints: BranchInfo[]
}

export async function readMessages(threadId: string): Promise<ReadMessagesResult> {
  const events = await messageLogFile(threadId).read()
  return reduceMessageEvents(events)
}
