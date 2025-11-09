import type { ConversationSummary } from './types'
import { explicitTitles } from './mockdata'
import { messageStore, getMessages } from '@arc/core/src/messages/api'

export function getConversationSummaries(): ConversationSummary[] {
  const conversationIds = new Set(messageStore.map((msg) => msg.conversationId))

  return Array.from(conversationIds).map((id) => {
    const explicitTitle = explicitTitles[id]

    if (explicitTitle) {
      return { id, title: explicitTitle }
    }

    const messages = getMessages(id)
    const firstMessage = messages[0]
    const generatedTitle = firstMessage.content.split('\n')[0]

    return { id, title: generatedTitle }
  })
}
