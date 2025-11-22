import { asc, eq } from 'drizzle-orm'
import type { Message } from '@arc/contracts/src/messages'
import { db } from '@/db/client'
import { messages } from '@/db/schema'

export async function getMessages(conversationId: string): Promise<Message[]> {
  const result = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt))

  return result.map((row) => ({
    id: row.id,
    conversationId: row.conversationId,
    role: row.role as 'user' | 'assistant' | 'system',
    status: 'complete' as const,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }))
}
