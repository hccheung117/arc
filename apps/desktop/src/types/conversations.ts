import type { z } from 'zod'
import {
  ConversationSummarySchema,
  ContextMenuActionSchema,
} from './conversations.schema'

export type ConversationSummary = z.infer<typeof ConversationSummarySchema>
export type ContextMenuAction = z.infer<typeof ContextMenuActionSchema>
