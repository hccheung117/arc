/**
 * Message Types and Schemas
 *
 * Zod schemas for message-related types with derived TypeScript types.
 */

import { z } from 'zod'

export const MessageStatusSchema = z.enum(['pending', 'streaming', 'complete', 'failed'])
export type MessageStatus = z.infer<typeof MessageStatusSchema>

export const MessageRoleSchema = z.enum(['user', 'assistant', 'system'])
export type MessageRole = z.infer<typeof MessageRoleSchema>

export const MessageContextMenuActionSchema = z.union([
  z.literal('copy'),
  z.literal('edit'),
  z.null(),
])
export type MessageContextMenuAction = z.infer<typeof MessageContextMenuActionSchema>

export const MessageAttachmentSchema = z.object({
  type: z.literal('image'),
  path: z.string(),
  mimeType: z.string(),
  url: z.string(),
})
export type MessageAttachment = z.infer<typeof MessageAttachmentSchema>

export const MessageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  role: MessageRoleSchema,
  status: MessageStatusSchema,
  content: z.string(),
  reasoning: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  error: z.instanceof(Error).optional(),
  attachments: z.array(MessageAttachmentSchema).optional(),
})
export type Message = z.infer<typeof MessageSchema>

export const StreamEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('delta'), chunk: z.string() }),
  z.object({ type: z.literal('complete'), message: MessageSchema }),
  z.object({ type: z.literal('error'), error: z.instanceof(Error) }),
])
export type StreamEvent = z.infer<typeof StreamEventSchema>

export interface MessageStreamHandle {
  readonly message: Message
  subscribe(listener: (event: StreamEvent) => void): () => void
  cancel(): void
}
