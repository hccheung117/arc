/**
 * Messages Business Logic
 *
 * Single source of truth for message domain: types, schemas, storage, and operations.
 * Absorbs boundary/messages, contracts/messages types, and lib/messages operations.
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import { z } from 'zod'
import { createId } from '@paralleldrive/cuid2'
// eslint-disable-next-line no-restricted-imports -- Temporary: storage instances until full cap-based migration
import { JsonFile } from '@main/foundation/json-file'
// eslint-disable-next-line no-restricted-imports -- Temporary: storage instances until full cap-based migration
import { JsonLog } from '@main/foundation/json-log'
import {
  getThreadIndexPath,
  getMessageLogPath,
  getThreadAttachmentsDir,
  getThreadAttachmentPath,
} from '@main/kernel/paths.tmp'

// ============================================================================
// SCHEMAS
// ============================================================================

export const PromptSourceSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('none') }),
  z.object({ type: z.literal('direct'), content: z.string() }),
  z.object({ type: z.literal('persona'), personaId: z.string() }),
])

const StoredAttachmentSchema = z.object({
  type: z.literal('image'),
  path: z.string(),
  mimeType: z.string(),
})

const UsageSchema = z.object({
  inputTokens: z.number().optional(),
  outputTokens: z.number().optional(),
  totalTokens: z.number().optional(),
  reasoningTokens: z.number().optional(),
  cachedInputTokens: z.number().optional(),
})

export const StoredMessageEventSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant', 'system']).optional(),
  content: z.string().optional(),
  reasoning: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  deleted: z.boolean().optional(),
  parentId: z.string().nullable().optional(),
  attachments: z.array(StoredAttachmentSchema).optional(),
  modelId: z.string().optional(),
  providerId: z.string().optional(),
  usage: UsageSchema.optional(),
})

// Recursive type requires explicit annotation
type StoredThreadType = {
  id: string
  title: string | null
  pinned: boolean
  renamed: boolean
  promptSource: PromptSource
  createdAt: string
  updatedAt: string
  children: StoredThreadType[]
}

const StoredThreadSchema: z.ZodType<StoredThreadType> = z.object({
  id: z.string(),
  title: z.string().nullable(),
  pinned: z.boolean(),
  renamed: z.boolean(),
  promptSource: PromptSourceSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  children: z.lazy(() => z.array(StoredThreadSchema)).default([]),
})

export const StoredThreadIndexSchema = z.object({
  threads: z.array(StoredThreadSchema),
})

// ============================================================================
// TYPES
// ============================================================================

export type PromptSource = z.infer<typeof PromptSourceSchema>
export type StoredAttachment = z.infer<typeof StoredAttachmentSchema>
export type Usage = z.infer<typeof UsageSchema>
export type StoredMessageEvent = z.infer<typeof StoredMessageEventSchema>
export type StoredThread = StoredThreadType
export type StoredThreadIndex = z.infer<typeof StoredThreadIndexSchema>
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

export type ThreadConfig = {
  promptSource: PromptSource
}

// ============================================================================
// STORAGE ACCESSORS
// ============================================================================

const threadIndexFile = () =>
  new JsonFile<StoredThreadIndex>(getThreadIndexPath(), { threads: [] }, StoredThreadIndexSchema)

const messageLogFile = (threadId: string) =>
  new JsonLog<StoredMessageEvent>(getMessageLogPath(threadId), StoredMessageEventSchema)

export const threadStorage = {
  read: () => threadIndexFile().read(),
  write: (data: StoredThreadIndex) => threadIndexFile().write(data),
  update: (updater: (data: StoredThreadIndex) => StoredThreadIndex) => threadIndexFile().update(updater),
}

export const messageStorage = {
  read: (threadId: string) => messageLogFile(threadId).read(),
  append: (threadId: string, event: StoredMessageEvent) => messageLogFile(threadId).append(event),
  delete: (threadId: string) => messageLogFile(threadId).delete(),
}

// ============================================================================
// ATTACHMENTS
// ============================================================================

const MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
}

export const attachmentStorage = {
  build(messageId: string, index: number, mimeType: string): StoredAttachment {
    const ext = MIME_TO_EXT[mimeType] || 'png'
    const filename = `${messageId}-${index}.${ext}`
    return { type: 'image', path: filename, mimeType }
  },

  async write(threadId: string, filename: string, data: string): Promise<void> {
    await fs.mkdir(getThreadAttachmentsDir(threadId), { recursive: true })
    const absolutePath = getThreadAttachmentPath(threadId, filename)
    const buffer = Buffer.from(data, 'base64')
    await fs.writeFile(absolutePath, buffer)
  },

  async deleteAll(threadId: string): Promise<void> {
    try {
      await fs.rm(getThreadAttachmentsDir(threadId), { recursive: true, force: true })
    } catch {
      // Directory may not exist
    }
  },
}

// ============================================================================
// BRANCH COMPUTATION
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

// ============================================================================
// MESSAGE EVENT REDUCER
// ============================================================================

export function reduceMessageEvents(events: StoredMessageEvent[]): {
  messages: StoredMessageEvent[]
  branchPoints: BranchInfo[]
} {
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
// TREE PRIMITIVES (used by thread effects)
// ============================================================================

export function findById(tree: StoredThread[], id: string): StoredThread | undefined {
  for (const t of tree) {
    if (t.id === id) return t
    const found = findById(t.children, id)
    if (found) return found
  }
}

export function updateById(
  tree: StoredThread[],
  id: string,
  fn: (t: StoredThread) => StoredThread,
): StoredThread[] {
  return tree.map((t) =>
    t.id === id ? fn(t) : { ...t, children: updateById(t.children, id, fn) },
  )
}

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
  promptSource: config?.promptSource ?? { type: 'none' },
  createdAt: timestamp,
  updatedAt: timestamp,
  children: [],
})

// ============================================================================
// THREAD EFFECTS (composable)
// ============================================================================

type ThreadEffect = (threadId: string, timestamp: string) => Promise<boolean>

const touchThread: ThreadEffect = async (threadId, timestamp) => {
  await threadStorage.update((index) => ({
    threads: updateById(index.threads, threadId, (t) => ({ ...t, updatedAt: timestamp })),
  }))
  return false
}

const ensureThread =
  (title: string | null, config?: ThreadConfig): ThreadEffect =>
  async (threadId, timestamp) => {
    let created = false
    await threadStorage.update((index) => {
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
// APPEND MESSAGE
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
      role: MessageRole
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
 * Effect ordering: log append → thread index → attachment data.
 */
export async function appendMessage(input: AppendMessageInput): Promise<AppendMessageResult> {
  const isNew = input.type === 'new'
  const id = isNew ? createId() : input.messageId
  const timestamp = now()

  const attachments: StoredAttachment[] | undefined = input.attachments?.length
    ? input.attachments.map((att, i) => attachmentStorage.build(id, i, att.mimeType))
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

  await messageStorage.append(input.threadId, event)
  const threadCreated = await threadEffect(input.threadId, timestamp)

  if (input.attachments?.length && attachments) {
    await Promise.all(
      input.attachments.map((att, i) =>
        attachmentStorage.write(input.threadId, attachments[i].path, att.data),
      ),
    )
  }

  return { message: event, threadCreated }
}

// ============================================================================
// READ MESSAGES
// ============================================================================

export interface ReadMessagesResult {
  messages: StoredMessageEvent[]
  branchPoints: BranchInfo[]
}

export async function readMessages(threadId: string): Promise<ReadMessagesResult> {
  const events = await messageStorage.read(threadId)
  return reduceMessageEvents(events)
}

// ============================================================================
// DATA OPERATIONS (exposed to threads module via deps)
// ============================================================================

/**
 * Deletes message log and attachments for a thread.
 */
export async function deleteThreadData(threadId: string): Promise<void> {
  await messageStorage.delete(threadId)
  await attachmentStorage.deleteAll(threadId)
}

/**
 * Copies message log and attachments from source to target thread.
 * If upToMessageId provided, filters to only the branch path to that message.
 */
export async function copyThreadData(
  sourceId: string,
  targetId: string,
  upToMessageId?: string,
): Promise<void> {
  const sourcePath = getMessageLogPath(sourceId)

  try {
    await fs.access(sourcePath)
  } catch {
    return
  }

  if (upToMessageId) {
    const events = await messageStorage.read(sourceId)
    const { filtered, attachmentPaths } = filterMessageEvents(events, upToMessageId)

    for (const event of filtered) {
      await messageStorage.append(targetId, event)
    }

    await copySelectiveAttachments(sourceId, targetId, attachmentPaths)
  } else {
    await fs.copyFile(sourcePath, getMessageLogPath(targetId))

    const sourceAttachmentsDir = getThreadAttachmentsDir(sourceId)
    const targetAttachmentsDir = getThreadAttachmentsDir(targetId)

    try {
      await fs.cp(sourceAttachmentsDir, targetAttachmentsDir, { recursive: true })
    } catch {
      // No attachments directory
    }
  }
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

function filterMessageEvents(
  events: StoredMessageEvent[],
  upToMessageId: string,
): { filtered: StoredMessageEvent[]; attachmentPaths: Set<string> } {
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

  const attachmentPaths = new Set<string>()
  for (const event of filtered) {
    if (event.attachments) {
      for (const att of event.attachments) {
        attachmentPaths.add(att.path)
      }
    }
  }

  return { filtered, attachmentPaths }
}

async function copySelectiveAttachments(
  sourceId: string,
  targetId: string,
  paths: Set<string>,
): Promise<void> {
  if (paths.size === 0) return

  const sourceDir = getThreadAttachmentsDir(sourceId)
  const targetDir = getThreadAttachmentsDir(targetId)

  await fs.mkdir(targetDir, { recursive: true })

  for (const relativePath of paths) {
    const sourcePath = path.join(sourceDir, relativePath)
    const targetPath = path.join(targetDir, relativePath)

    try {
      await fs.copyFile(sourcePath, targetPath)
    } catch {
      // Attachment missing - skip
    }
  }
}
