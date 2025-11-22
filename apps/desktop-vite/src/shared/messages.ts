export type MessageStatus = 'pending' | 'streaming' | 'complete' | 'failed'
export type MessageRole = 'user' | 'assistant' | 'system'

export interface Message {
  readonly id: string
  readonly conversationId: string
  readonly role: MessageRole
  readonly status: MessageStatus
  readonly content: string
  readonly createdAt: string
  readonly updatedAt: string
  readonly error?: Error
}

export type StreamEvent =
  | { type: 'delta'; chunk: string }
  | { type: 'complete'; message: Message }
  | { type: 'error'; error: Error }

export interface MessageStreamHandle {
  readonly message: Message
  subscribe(listener: (event: StreamEvent) => void): () => void
  cancel(): void
}
