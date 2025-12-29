/**
 * ArcAPI Type Definitions
 *
 * This file defines the contract for window.arc, the IPC surface
 * exposed via contextBridge. It follows a resource-based API design
 * using three canonical IPC patterns:
 *
 * - Rule 1 (One-Way): Renderer → Main, fire-and-forget
 * - Rule 2 (Two-Way): Renderer → Main with response
 * - Rule 3 (Push): Main → Renderer event subscription
 */

import { z } from 'zod'
import type { Message } from './messages'
import { MessageRoleSchema } from './messages'
import type { ConversationSummary } from './conversations'
import type { Model } from './models'
import type { ProfileInfo, ProfileInstallResult, ProfilesEvent } from './arc-file'

// ============================================================================
// IPC INPUT SCHEMAS
// ============================================================================

export const ConversationPatchSchema = z.object({
  title: z.string().optional(),
  pinned: z.boolean().optional(),
})
export type ConversationPatch = z.infer<typeof ConversationPatchSchema>

export const AttachmentInputSchema = z.object({
  type: z.literal('image'),
  data: z.string(),
  mimeType: z.string(),
  name: z.string().optional(),
})
export type AttachmentInput = z.infer<typeof AttachmentInputSchema>

export const CreateMessageInputSchema = z.object({
  role: MessageRoleSchema,
  content: z.string(),
  parentId: z.string().nullable(),
  attachments: z.array(AttachmentInputSchema).optional(),
  modelId: z.string(),
  providerId: z.string(),
})
export type CreateMessageInput = z.infer<typeof CreateMessageInputSchema>

export const CreateBranchInputSchema = z.object({
  parentId: z.string().nullable(),
  content: z.string(),
  attachments: z.array(AttachmentInputSchema).optional(),
  modelId: z.string(),
  providerId: z.string(),
})
export type CreateBranchInput = z.infer<typeof CreateBranchInputSchema>

export const UpdateMessageInputSchema = z.object({
  content: z.string(),
})
export type UpdateMessageInput = z.infer<typeof UpdateMessageInputSchema>

export const ChatOptionsSchema = z.object({
  model: z.string(),
})
export type ChatOptions = z.infer<typeof ChatOptionsSchema>

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
export type Conversation = z.infer<typeof ConversationSchema>

export const BranchInfoSchema = z.object({
  parentId: z.string().nullable(),
  branches: z.array(z.string()),
  currentIndex: z.number(),
})
export type BranchInfo = z.infer<typeof BranchInfoSchema>

export const ChatResponseSchema = z.object({
  streamId: z.string(),
})
export type ChatResponse = z.infer<typeof ChatResponseSchema>

// ============================================================================
// ADDITIONAL TYPES
// ============================================================================

/** Cleanup function returned by event subscriptions */
export type Unsubscribe = () => void

/** Conversation lifecycle events (Rule 3: Push) */
export type ConversationEvent =
  | { type: 'created'; conversation: Conversation }
  | { type: 'updated'; conversation: Conversation }
  | { type: 'deleted'; id: string }

/** Result of listing messages with branch info */
export interface ListMessagesResult {
  messages: Message[]
  branchPoints: BranchInfo[]
}

/** Create branch result */
export interface CreateBranchResult {
  message: Message
  branchPoints: BranchInfo[]
}

/** AI stream events (IPC-safe: error is string, not Error object) */
export type AIStreamEvent =
  | { type: 'delta'; streamId: string; chunk: string }
  | { type: 'reasoning'; streamId: string; chunk: string }
  | { type: 'complete'; streamId: string; message: Message }
  | { type: 'error'; streamId: string; error: string }

/** Models cache update events (Rule 3: Push) */
export type ModelsEvent = { type: 'updated' }

// ============================================================================
// ArcAPI INTERFACE
// ============================================================================

/**
 * ArcAPI - The IPC surface for renderer process
 *
 * Accessed via window.arc in the renderer. Organized as a resource-based
 * API with standard CRUD-like operations per resource.
 */
export interface ArcAPI {
  /** Conversation resource operations */
  conversations: {
    /** List all conversations (Rule 2: Two-Way) */
    list(): Promise<ConversationSummary[]>

    /** Update conversation properties (Rule 2: Two-Way) */
    update(id: string, patch: ConversationPatch): Promise<Conversation>

    /** Delete a conversation (Rule 2: Two-Way) */
    delete(id: string): Promise<void>

    /** Subscribe to conversation lifecycle events (Rule 3: Push) */
    onEvent(callback: (event: ConversationEvent) => void): Unsubscribe
  }

  /** Message resource operations */
  messages: {
    /** List messages for a conversation with branch info (Rule 2: Two-Way) */
    list(conversationId: string): Promise<ListMessagesResult>

    /**
     * Create a new message (Rule 2: Two-Way)
     * Auto-creates conversation if it doesn't exist, triggering a
     * conversations.onEvent('created') event.
     */
    create(conversationId: string, input: CreateMessageInput): Promise<Message>

    /**
     * Create a new branch (Rule 2: Two-Way)
     * Used for "edit and regenerate" flow - creates new branch, preserves old conversation.
     */
    createBranch(conversationId: string, input: CreateBranchInput): Promise<CreateBranchResult>

    /**
     * Update an existing message's content (Rule 2: Two-Way)
     * Used for editing assistant messages in place without regeneration.
     */
    update(conversationId: string, messageId: string, input: UpdateMessageInput): Promise<Message>
  }

  /** Model resource operations */
  models: {
    /** List available AI models (Rule 2: Two-Way) */
    list(): Promise<Model[]>

    /** Subscribe to model cache update events (Rule 3: Push) */
    onEvent(callback: (event: ModelsEvent) => void): Unsubscribe
  }

  /** AI streaming operations */
  ai: {
    /**
     * Start AI chat response stream (Rule 2: Two-Way)
     * Returns streamId for tracking. Listen to onEvent for streaming data.
     */
    chat(conversationId: string, options: ChatOptions): Promise<ChatResponse>

    /** Cancel an active stream (Rule 2: Two-Way) */
    stop(streamId: string): Promise<void>

    /** Subscribe to all AI stream events (Rule 3: Push) */
    onEvent(callback: (event: AIStreamEvent) => void): Unsubscribe
  }

  /** Configuration key-value store */
  config: {
    /** Get a configuration value (Rule 2: Two-Way) */
    get<T = unknown>(key: string): Promise<T | null>

    /** Set a configuration value (Rule 2: Two-Way) */
    set<T = unknown>(key: string, value: T): Promise<void>
  }

  /** Native UI operations */
  ui: {
    /**
     * Show thread context menu (Rule 2: Two-Way)
     * Data operations (delete, togglePin) are executed in main process.
     * Returns 'rename' for UI-only action, or null otherwise.
     */
    showThreadContextMenu(threadId: string, isPinned: boolean): Promise<'rename' | null>

    /**
     * Show message context menu (Rule 2: Two-Way)
     * Returns the selected action for caller to handle side effects.
     */
    showMessageContextMenu(hasEditOption: boolean): Promise<'copy' | 'edit' | null>
  }

  /** Profile management operations */
  profiles: {
    /** List installed profiles (Rule 2: Two-Way) */
    list(): Promise<ProfileInfo[]>

    /** Get active profile ID (Rule 2: Two-Way) */
    getActive(): Promise<string | null>

    /** Install a profile from file path (Rule 2: Two-Way) */
    install(filePath: string): Promise<ProfileInstallResult>

    /** Uninstall a profile (Rule 2: Two-Way) */
    uninstall(profileId: string): Promise<void>

    /** Activate a profile (Rule 2: Two-Way) */
    activate(profileId: string | null): Promise<void>

    /** Subscribe to profile lifecycle events (Rule 3: Push) */
    onEvent(callback: (event: ProfilesEvent) => void): Unsubscribe
  }

  /** Electron utilities exposed to renderer */
  utils: {
    /** Get file path from a dropped File object */
    getFilePath(file: File): string

    /** Open a file with the native OS viewer */
    openFile(filePath: string): Promise<void>

    /** Get absolute path for an attachment */
    getThreadAttachmentPath(conversationId: string, relativePath: string): Promise<string>
  }

  /** Logging utilities (Rule 1: One-Way) */
  log: {
    /** Send error to main process for file logging in production */
    error(tag: string, message: string, stack?: string): void
  }
}

declare global {
  interface Window {
    arc: ArcAPI
  }
}
