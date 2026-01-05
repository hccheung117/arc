/**
 * Thread Types and Schemas
 *
 * Zod schemas for thread-related types with derived TypeScript types.
 */

import { z } from 'zod'

/**
 * Recursive thread summary - threads can contain other threads (folders).
 * A thread with non-empty children[] acts as a folder.
 */
export type ThreadSummary = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  pinned: boolean
  children: ThreadSummary[]
}

export const ThreadSummarySchema: z.ZodType<ThreadSummary> = z.object({
  id: z.string(),
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  pinned: z.boolean(),
  children: z.lazy(() => z.array(ThreadSummarySchema)).default([]),
})

export const ContextMenuActionSchema = z.union([z.literal('rename'), z.null()])
export type ContextMenuAction = z.infer<typeof ContextMenuActionSchema>
