import type { ConversationSummary } from '@arc/contracts/src/conversations'
import { getMessages } from '@/core/messages/handlers'
import { db } from '@/db/client'
import { conversations, messages } from '@/db/schema'
import { desc, eq } from 'drizzle-orm'

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

      // Handle empty conversations (conversation-as-by-product pattern)
      if (!firstMessage) {
        return { ...base, title: 'New Chat' }
      }

      const generatedTitle = firstMessage.content.split('\n')[0]

      return { ...base, title: generatedTitle }
    })
  )
}

export async function deleteConversation(conversationId: string): Promise<void> {
  // Delete messages first, then conversation
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
