import type { ConversationSummary } from '@arc-types/conversations'
import type { Conversation, ConversationPatch } from '@arc-types/arc-api'
import { getMessages } from './messages'
import { threadIndexFile, messageLogFile, type StoredThread } from '@main/storage'

/**
 * Converts a StoredThread to a Conversation entity.
 */
export function toConversation(thread: StoredThread): Conversation {
  return {
    id: thread.id,
    title: thread.title ?? 'New Chat',
    pinned: thread.pinned,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
  }
}

/**
 * Returns all conversation summaries for the sidebar.
 * Threads are sorted by last update time (most recent first).
 * Titles are either user-set or auto-generated from the first message.
 */
export async function getConversationSummaries(): Promise<ConversationSummary[]> {
  const index = await threadIndexFile().read()

  // Sort by updatedAt descending (most recent first)
  const sortedThreads = [...index.threads].sort((a, b) => {
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })

  return Promise.all(
    sortedThreads.map(async (thread) => {
      const base = { id: thread.id, updatedAt: thread.updatedAt, pinned: thread.pinned }

      // If user has set a custom title, use it
      if (thread.title !== null) {
        return { ...base, title: thread.title }
      }

      // Otherwise, generate title from first message
      const conversationMessages = await getMessages(thread.id)
      const firstMessage = conversationMessages[0]

      if (!firstMessage) {
        return { ...base, title: 'New Chat' }
      }

      const generatedTitle = firstMessage.content.split('\n')[0]

      return { ...base, title: generatedTitle }
    }),
  )
}

/**
 * Updates a conversation with a partial patch.
 * Returns the updated conversation. Event emission is handled by IPC layer.
 */
export async function updateConversation(
  id: string,
  patch: ConversationPatch,
): Promise<Conversation> {
  let updatedThread: StoredThread | undefined

  await threadIndexFile().update((index) => {
    const thread = index.threads.find((t) => t.id === id)
    if (!thread) {
      throw new Error(`Conversation not found: ${id}`)
    }

    // Apply patch
    const now = new Date().toISOString()
    if (patch.title !== undefined) {
      thread.title = patch.title
      thread.renamed = true
    }
    if (patch.pinned !== undefined) {
      thread.pinned = patch.pinned
    }
    thread.updatedAt = now

    updatedThread = thread
    return index
  })

  if (!updatedThread) {
    throw new Error(`Failed to update conversation: ${id}`)
  }

  return toConversation(updatedThread)
}

/**
 * Deletes a conversation and all its messages.
 * Removes the thread from the index and deletes its message log file.
 */
export async function deleteConversation(conversationId: string): Promise<void> {
  // Remove from index
  await threadIndexFile().update((index) => {
    index.threads = index.threads.filter((t) => t.id !== conversationId)
    return index
  })

  // Delete message log file
  await messageLogFile(conversationId).delete()
}

/**
 * Renames a conversation by setting a custom title.
 * Marks the conversation as renamed so auto-generation doesn't override it.
 */
export async function renameConversation(conversationId: string, title: string): Promise<void> {
  await threadIndexFile().update((index) => {
    const thread = index.threads.find((t) => t.id === conversationId)
    if (!thread) {
      throw new Error(`Conversation not found: ${conversationId}`)
    }
    thread.title = title
    thread.renamed = true
    thread.updatedAt = new Date().toISOString()
    return index
  })
}

/**
 * Toggles the pinned status of a conversation.
 */
export async function toggleConversationPin(conversationId: string, pinned: boolean): Promise<void> {
  await threadIndexFile().update((index) => {
    const thread = index.threads.find((t) => t.id === conversationId)
    if (!thread) {
      throw new Error(`Conversation not found: ${conversationId}`)
    }
    thread.pinned = pinned
    thread.updatedAt = new Date().toISOString()
    return index
  })
}
