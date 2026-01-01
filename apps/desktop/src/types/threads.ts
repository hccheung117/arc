/**
 * Thread Types and Schemas
 *
 * Zod schemas for thread-related types with derived TypeScript types.
 */

import { z } from 'zod'

export const ThreadSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  pinned: z.boolean(),
})
export type ThreadSummary = z.infer<typeof ThreadSummarySchema>

export const ContextMenuActionSchema = z.union([z.literal('rename'), z.null()])
export type ContextMenuAction = z.infer<typeof ContextMenuActionSchema>
