import type { z } from 'zod'
import {
  MessageStatusSchema,
  MessageRoleSchema,
  MessageContextMenuActionSchema,
  MessageAttachmentSchema,
  MessageSchema,
  StreamEventSchema,
} from './messages.schema'

export type MessageStatus = z.infer<typeof MessageStatusSchema>
export type MessageRole = z.infer<typeof MessageRoleSchema>
export type MessageContextMenuAction = z.infer<typeof MessageContextMenuActionSchema>
export type MessageAttachment = z.infer<typeof MessageAttachmentSchema>
export type Message = z.infer<typeof MessageSchema>
export type StreamEvent = z.infer<typeof StreamEventSchema>

export interface MessageStreamHandle {
  readonly message: Message
  subscribe(listener: (event: StreamEvent) => void): () => void
  cancel(): void
}
