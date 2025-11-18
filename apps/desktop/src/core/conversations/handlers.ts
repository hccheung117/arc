import type { ConversationSummary } from '@arc/contracts/src/conversations'
import { getMessages } from '@/core/messages/handlers'
import { db } from '@/db/client'
import { conversations } from '@/db/schema'
import { desc } from 'drizzle-orm'

export async function getConversationSummaries(): Promise<ConversationSummary[]> {
  const result = await db.select().from(conversations).orderBy(desc(conversations.updatedAt))

  return Promise.all(
    result.map(async (row) => {
      if (row.title !== null) {
        return { id: row.id, title: row.title, updatedAt: row.updatedAt }
      }

      const conversationMessages = await getMessages(row.id)
      const firstMessage = conversationMessages[0]

      // Handle empty conversations (conversation-as-by-product pattern)
      if (!firstMessage) {
        return { id: row.id, title: 'New Chat', updatedAt: row.updatedAt }
      }

      const generatedTitle = firstMessage.content.split('\n')[0]

      return { id: row.id, title: generatedTitle, updatedAt: row.updatedAt }
    })
  )
}
