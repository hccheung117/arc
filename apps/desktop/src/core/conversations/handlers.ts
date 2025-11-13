import { sql } from 'drizzle-orm'
import type { ConversationSummary } from '@arc/contracts/src/conversations'
import { explicitTitles } from './mockdata'
import { getMessages } from '../messages/handlers'
import { db } from '../../db/client'
import { messages } from '../../db/schema'

export async function getConversationSummaries(): Promise<ConversationSummary[]> {
  const result = await db
    .select({ conversationId: messages.conversationId })
    .from(messages)
    .groupBy(messages.conversationId)

  const conversationIds = result.map((row) => row.conversationId)

  return Promise.all(
    conversationIds.map(async (id) => {
      const explicitTitle = explicitTitles[id]

      if (explicitTitle) {
        return { id, title: explicitTitle }
      }

      const conversationMessages = await getMessages(id)
      const firstMessage = conversationMessages[0]
      const generatedTitle = firstMessage.content.split('\n')[0]

      return { id, title: generatedTitle }
    })
  )
}
