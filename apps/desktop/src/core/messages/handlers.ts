import { asc, eq } from 'drizzle-orm'
import type { Message, MessageStreamHandle, StreamEvent } from '@arc/contracts/src/messages'
import { db } from '@/db/client'
import { conversations, messages } from '@/db/schema'

let nextId = 1

async function ensureConversationExists(conversationId: string): Promise<void> {
  const existing = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1)

  if (existing.length === 0) {
    const now = new Date().toISOString()
    await db.insert(conversations).values({
      id: conversationId,
      title: null,
      createdAt: now,
      updatedAt: now,
    })
  }
}

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
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }))
}

export async function addUserMessage(conversationId: string, content: string): Promise<Message> {
  await ensureConversationExists(conversationId)

  const now = new Date().toISOString()
  const messageId = String(nextId++)

  await db.insert(messages).values({
    id: messageId,
    conversationId,
    role: 'user',
    content,
    createdAt: now,
    updatedAt: now,
  })

  return {
    id: messageId,
    conversationId,
    role: 'user',
    status: 'complete',
    content,
    createdAt: now,
    updatedAt: now,
  }
}

export async function addAssistantMessage(conversationId: string, content: string): Promise<Message> {
  await ensureConversationExists(conversationId)

  const now = new Date().toISOString()
  const messageId = String(nextId++)

  await db.insert(messages).values({
    id: messageId,
    conversationId,
    role: 'assistant',
    content,
    createdAt: now,
    updatedAt: now,
  })

  return {
    id: messageId,
    conversationId,
    role: 'assistant',
    status: 'complete',
    content,
    createdAt: now,
    updatedAt: now,
  }
}

export function streamAssistantMessage(
  conversationId: string,
  content: string
): MessageStreamHandle {
  const now = new Date().toISOString()
  const messageId = String(nextId++)

  const message: Message = {
    id: messageId,
    conversationId,
    role: 'assistant',
    status: 'complete',
    content,
    createdAt: now,
    updatedAt: now,
  }

  ensureConversationExists(conversationId)
    .then(() =>
      db.insert(messages).values({
        id: messageId,
        conversationId,
        role: 'assistant',
        content,
        createdAt: now,
        updatedAt: now,
      })
    )
    .then(() => {})
    .catch((error) => {
      console.error('Failed to insert assistant message:', error)
    })

  const listeners: Array<(event: StreamEvent) => void> = []

  setTimeout(() => {
    listeners.forEach((listener) => listener({ type: 'complete', message }))
  }, 0)

  return {
    get message() {
      return message
    },
    subscribe(listener: (event: StreamEvent) => void) {
      listeners.push(listener)
      return () => {
        const index = listeners.indexOf(listener)
        if (index > -1) {
          listeners.splice(index, 1)
        }
      }
    },
    cancel() {
      listeners.forEach((listener) =>
        listener({ type: 'error', error: new Error('Cancelled') })
      )
    },
  }
}
