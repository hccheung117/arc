/**
 * ArcAPI Schema Definitions
 *
 * Zod schemas for IPC input validation.
 * Types are derived from these schemas using z.infer<>.
 */

import { z } from 'zod'
import { MessageRoleSchema } from './messages.schema'

// ============================================================================
// IPC INPUT SCHEMAS
// ============================================================================

export const ConversationPatchSchema = z.object({
  title: z.string().optional(),
  pinned: z.boolean().optional(),
})

export const AttachmentInputSchema = z.object({
  type: z.literal('image'),
  data: z.string(),
  mimeType: z.string(),
  name: z.string().optional(),
})

export const CreateMessageInputSchema = z.object({
  role: MessageRoleSchema,
  content: z.string(),
  parentId: z.string().nullable(),
  attachments: z.array(AttachmentInputSchema).optional(),
  modelId: z.string(),
  providerId: z.string(),
})

export const CreateBranchInputSchema = z.object({
  parentId: z.string().nullable(),
  content: z.string(),
  attachments: z.array(AttachmentInputSchema).optional(),
  modelId: z.string(),
  providerId: z.string(),
})

export const ChatOptionsSchema = z.object({
  model: z.string(),
})

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

export const ConversationSchema = z.object({
  id: z.string(),
  title: z.string(),
  pinned: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const BranchInfoSchema = z.object({
  parentId: z.string().nullable(),
  branches: z.array(z.string()),
  currentIndex: z.number(),
})

export const ChatResponseSchema = z.object({
  streamId: z.string(),
})
