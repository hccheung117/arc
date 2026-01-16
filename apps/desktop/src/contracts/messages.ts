/**
 * Messages Contract
 *
 * Message CRUD and branching operations.
 */

import { z } from 'zod'
import { contract, op, returns } from '@main/foundation/contract'
import type { StoredMessageEvent } from '@boundary/messages'

// ============================================================================
// SHARED TYPES
// ============================================================================

export type MessageRole = 'user' | 'assistant' | 'system'

// ============================================================================
// BRANCH INFO (defined here to avoid circular imports)
// ============================================================================

export const BranchInfoSchema = z.object({
  parentId: z.string().nullable(),
  branches: z.array(z.string()),
  currentIndex: z.number(),
})
export type BranchInfo = z.infer<typeof BranchInfoSchema>

// ============================================================================
// SCHEMAS
// ============================================================================

const AttachmentInputSchema = z.object({
  type: z.literal('image'),
  data: z.string(),
  mimeType: z.string(),
  name: z.string().optional(),
})

const ThreadConfigSchema = z.object({
  systemPrompt: z.string().nullable(),
})

export const CreateMessageInputSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  parentId: z.string().nullable(),
  attachments: z.array(AttachmentInputSchema).optional(),
  modelId: z.string(),
  providerId: z.string(),
  threadConfig: ThreadConfigSchema.optional(),
})

export const CreateBranchInputSchema = z.object({
  parentId: z.string().nullable(),
  content: z.string(),
  attachments: z.array(AttachmentInputSchema).optional(),
  modelId: z.string(),
  providerId: z.string(),
  threadConfig: ThreadConfigSchema.optional(),
})

export const UpdateMessageInputSchema = z.object({
  content: z.string(),
  modelId: z.string(),
  providerId: z.string(),
  attachments: z.array(AttachmentInputSchema).optional(),
  reasoning: z.string().optional(),
})

// ============================================================================
// RESPONSE TYPES
// ============================================================================

export interface ListMessagesResult {
  messages: StoredMessageEvent[]
  branchPoints: BranchInfo[]
}

export interface CreateBranchResult {
  message: StoredMessageEvent
  branchPoints: BranchInfo[]
}

// ============================================================================
// CONTRACT
// ============================================================================

export const messagesContract = contract('messages', {
  /** List messages for a thread with branch info */
  list: op(
    z.object({ threadId: z.string() }),
    returns<ListMessagesResult>(),
  ),

  /**
   * Create a new message.
   * Auto-creates thread if it doesn't exist.
   */
  create: op(
    z.object({
      threadId: z.string(),
      input: CreateMessageInputSchema,
    }),
    returns<StoredMessageEvent>(),
  ),

  /**
   * Create a new branch from a parent message.
   * Used for "edit and regenerate" flow.
   */
  createBranch: op(
    z.object({
      threadId: z.string(),
      input: CreateBranchInputSchema,
    }),
    returns<CreateBranchResult>(),
  ),

  /** Update an existing message's content */
  update: op(
    z.object({
      threadId: z.string(),
      messageId: z.string(),
      input: UpdateMessageInputSchema,
    }),
    returns<StoredMessageEvent>(),
  ),
})

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type CreateMessageInput = z.infer<typeof CreateMessageInputSchema>
export type CreateBranchInput = z.infer<typeof CreateBranchInputSchema>
export type UpdateMessageInput = z.infer<typeof UpdateMessageInputSchema>
export type AttachmentInput = z.infer<typeof AttachmentInputSchema>
export type ThreadConfig = z.infer<typeof ThreadConfigSchema>
export type Message = StoredMessageEvent
