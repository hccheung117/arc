/**
 * Conversation Schema Definitions
 *
 * Zod schemas for conversation-related types.
 * Types are derived from these schemas using z.infer<>.
 */

import { z } from 'zod'

export const ConversationSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  pinned: z.boolean(),
})

export const ContextMenuActionSchema = z.union([
  z.literal('rename'),
  z.literal('delete'),
  z.literal('togglePin'),
  z.null(),
])
