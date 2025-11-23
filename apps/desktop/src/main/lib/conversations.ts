import type { ConversationSummary } from '@arc-types/conversations'
import type { Conversation, ConversationPatch } from '@arc-types/arc-api'
import { getMessages } from './messages'
import { db } from '@main/db/client'
import { conversations, messages } from '@main/db/schema'
import { desc, eq } from 'drizzle-orm'

type ConversationRow = {
  id: string
  title: string | null
  pinned: boolean | null
  createdAt: Date
  updatedAt: Date
}

/**
 * Converts a database row to a Conversation entity.
 */
export function toConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    title: row.title ?? 'New Chat',
    pinned: row.pinned ?? false,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function getConversationSummaries(): Promise<ConversationSummary[]> {
  const result = await db.select().from(conversations).orderBy(desc(conversations.updatedAt))

  return Promise.all(
    result.map(async (row) => {
      const base = { id: row.id, updatedAt: row.updatedAt.toISOString(), pinned: !!row.pinned }

      if (row.title !== null) {
        return { ...base, title: row.title }
      }

      const conversationMessages = await getMessages(row.id)
      const firstMessage = conversationMessages[0]

      if (!firstMessage) {
        return { ...base, title: 'New Chat' }
      }

      const generatedTitle = firstMessage.content.split('\n')[0]

      return { ...base, title: generatedTitle }
    })
  )
}

/**
 * Updates a conversation with a partial patch.
 * Returns the updated conversation. Event emission is handled by IPC layer.
 */
export async function updateConversation(
  id: string,
  patch: ConversationPatch
): Promise<Conversation> {
  const updateData: { title?: string; pinned?: boolean; updatedAt: Date } = {
    updatedAt: new Date(),
  }

  if (patch.title !== undefined) {
    updateData.title = patch.title
  }
  if (patch.pinned !== undefined) {
    updateData.pinned = patch.pinned
  }

  await db.update(conversations).set(updateData).where(eq(conversations.id, id))

  const [row] = await db.select().from(conversations).where(eq(conversations.id, id))

  if (!row) {
    throw new Error(`Conversation not found: ${id}`)
  }

  return toConversation(row)
}

/**
 * Ensures a conversation exists. Returns existing or newly created conversation.
 * Event emission is handled by IPC layer.
 *
 * @returns Object with conversation and wasCreated flag for IPC layer to emit appropriate event
 */
export async function ensureConversation(
  conversationId: string
): Promise<{ conversation: Conversation; wasCreated: boolean }> {
  const [existing] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))

  if (existing) {
    return { conversation: toConversation(existing), wasCreated: false }
  }

  const now = new Date()
  await db.insert(conversations).values({
    id: conversationId,
    title: null,
    pinned: false,
    createdAt: now,
    updatedAt: now,
  })

  const [created] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))

  if (!created) {
    throw new Error(`Failed to create conversation: ${conversationId}`)
  }

  return { conversation: toConversation(created), wasCreated: true }
}

export async function deleteConversation(conversationId: string): Promise<void> {
  await db.delete(messages).where(eq(messages.conversationId, conversationId))
  await db.delete(conversations).where(eq(conversations.id, conversationId))
}

export async function renameConversation(conversationId: string, title: string): Promise<void> {
  await db
    .update(conversations)
    .set({ title, updatedAt: new Date() })
    .where(eq(conversations.id, conversationId))
}

export async function toggleConversationPin(conversationId: string, pinned: boolean): Promise<void> {
  await db
    .update(conversations)
    .set({ pinned, updatedAt: new Date() })
    .where(eq(conversations.id, conversationId))
}
