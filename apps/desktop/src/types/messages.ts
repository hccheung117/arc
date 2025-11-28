export type MessageStatus = 'pending' | 'streaming' | 'complete' | 'failed'
export type MessageRole = 'user' | 'assistant' | 'system'

export interface MessageAttachment {
  readonly type: 'image'
  readonly path: string // Relative path: {messageId}-{index}.{ext}
  readonly mimeType: string // image/png, image/jpeg, image/gif, image/webp
  readonly url: string // data: URL for display (hydrated on read)
}

export interface Message {
  readonly id: string
  readonly conversationId: string
  readonly role: MessageRole
  readonly status: MessageStatus
  readonly content: string
  readonly createdAt: string
  readonly updatedAt: string
  readonly error?: Error
  readonly attachments?: MessageAttachment[]
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
