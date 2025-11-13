import type { ConversationSummary } from '@arc/contracts/src/conversations'
import { getMessages } from '../messages/handlers'
import { db } from '../../db/client'
import { conversations } from '../../db/schema'

export async function getConversationSummaries(): Promise<ConversationSummary[]> {
  const result = await db.select().from(conversations)

  return Promise.all(
    result.map(async (row) => {
      if (row.title !== null) {
        return { id: row.id, title: row.title }
      }

      const conversationMessages = await getMessages(row.id)
      const firstMessage = conversationMessages[0]
      const generatedTitle = firstMessage.content.split('\n')[0]

      return { id: row.id, title: generatedTitle }
    })
  )
}
