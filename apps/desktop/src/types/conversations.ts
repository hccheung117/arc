/**
 * Conversation Types and Schemas
 *
 * Zod schemas for conversation-related types with derived TypeScript types.
 */

import { z } from 'zod'

export const ConversationSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  pinned: z.boolean(),
})
export type ConversationSummary = z.infer<typeof ConversationSummarySchema>

export const ContextMenuActionSchema = z.union([
  z.literal('rename'),
  z.literal('delete'),
  z.literal('togglePin'),
  z.null(),
])
export type ContextMenuAction = z.infer<typeof ContextMenuActionSchema>
