import type { Message, MessageStreamHandle, StreamEvent } from './types'
import { messages as initialMessages } from './mockdata'

let messageStore: Message[] = [...initialMessages]
let nextId = messageStore.length + 1

export function getMessages(conversationId: string): Message[] {
  return messageStore
    .filter((msg) => msg.conversationId === conversationId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}

export function addUserMessage(conversationId: string, content: string): Message {
  const now = new Date().toISOString()
  const message: Message = {
    id: String(nextId++),
    conversationId,
    role: 'user',
    status: 'complete',
    content,
    createdAt: now,
    updatedAt: now,
  }

  messageStore.push(message)
  return message
}

export function streamAssistantMessage(
  conversationId: string,
  content: string
): MessageStreamHandle {
  const now = new Date().toISOString()
  const messageId = String(nextId++)

  let message: Message = {
    id: messageId,
    conversationId,
    role: 'assistant',
    status: 'pending',
    content: '',
    createdAt: now,
    updatedAt: now,
  }

  const listeners: Array<(event: StreamEvent) => void> = []
  let cancelled = false
  let streamingTimeout: NodeJS.Timeout | null = null

  const chunks = content.split(' ')

  const startStreaming = () => {
    message = { ...message, status: 'streaming' }

    let currentIndex = 0
    const streamNextChunk = () => {
      if (cancelled || currentIndex >= chunks.length) {
        if (!cancelled) {
          message = { ...message, status: 'complete', updatedAt: new Date().toISOString() }
          messageStore.push(message)
          listeners.forEach((listener) =>
            listener({ type: 'complete', message })
          )
        }
        return
      }

      const chunk = chunks[currentIndex] + (currentIndex < chunks.length - 1 ? ' ' : '')
      currentIndex++

      message = { ...message, content: message.content + chunk, updatedAt: new Date().toISOString() }
      listeners.forEach((listener) => listener({ type: 'delta', chunk }))

      streamingTimeout = setTimeout(streamNextChunk, 50)
    }

    setTimeout(streamNextChunk, 100)
  }

  startStreaming()

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
      cancelled = true
      if (streamingTimeout) {
        clearTimeout(streamingTimeout)
      }
      message = { ...message, status: 'failed', error: new Error('Cancelled'), updatedAt: new Date().toISOString() }
      listeners.forEach((listener) =>
        listener({ type: 'error', error: new Error('Cancelled') })
      )
    },
  }
}
