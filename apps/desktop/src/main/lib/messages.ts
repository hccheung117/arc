import { asc, eq } from 'drizzle-orm'
import type { Message, MessageRole } from '@arc-types/messages'
import { db } from '@main/db/client'
import { conversations, messages } from '@main/db/schema'

type MessageRow = {
  id: string
  conversationId: string
  role: string
  content: string
  createdAt: Date
  updatedAt: Date
}

/**
 * Converts a database row to a Message entity.
 */
export function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    conversationId: row.conversationId,
    role: row.role as 'user' | 'assistant' | 'system',
    status: 'complete',
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const result = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt))

  return result.map(toMessage)
}

/**
 * Creates a new message in the database.
 * Also updates the conversation's updatedAt timestamp.
 */
export async function createMessage(
  conversationId: string,
  input: { role: MessageRole; content: string }
): Promise<Message> {
  const now = new Date()
  const [inserted] = await db
    .insert(messages)
    .values({
      conversationId,
      role: input.role,
      content: input.content,
      createdAt: now,
      updatedAt: now,
    })
    .returning()

  await db
    .update(conversations)
    .set({ updatedAt: now })
    .where(eq(conversations.id, conversationId))

  return toMessage(inserted)
}

/**
 * Inserts an assistant message to database.
 * Also updates the conversation's updatedAt timestamp.
 */
export async function insertAssistantMessage(
  conversationId: string,
  content: string
): Promise<Message> {
  const now = new Date()
  const [inserted] = await db
    .insert(messages)
    .values({
      conversationId,
      role: 'assistant',
      content,
      createdAt: now,
      updatedAt: now,
    })
    .returning()

  await db
    .update(conversations)
    .set({ updatedAt: now })
    .where(eq(conversations.id, conversationId))

  return toMessage(inserted)
}
