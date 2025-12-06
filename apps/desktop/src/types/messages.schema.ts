/**
 * Message Schema Definitions
 *
 * Zod schemas for message-related types.
 * Types are derived from these schemas using z.infer<>.
 */

import { z } from 'zod'

export const MessageStatusSchema = z.enum(['pending', 'streaming', 'complete', 'failed'])
export const MessageRoleSchema = z.enum(['user', 'assistant', 'system'])
export const MessageContextMenuActionSchema = z.union([
  z.literal('copy'),
  z.literal('edit'),
  z.null(),
])

export const MessageAttachmentSchema = z.object({
  type: z.literal('image'),
  path: z.string(),
  mimeType: z.string(),
  url: z.string(),
})

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

export const StreamEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('delta'), chunk: z.string() }),
  z.object({ type: z.literal('complete'), message: MessageSchema }),
  z.object({ type: z.literal('error'), error: z.instanceof(Error) }),
])
