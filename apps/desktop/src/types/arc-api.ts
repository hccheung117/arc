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
import type { ThreadSummary } from './threads'
import type { Model } from './models'
import type { ProfileInfo, ProfileInstallResult, ProfilesEvent } from './arc-file'

// ============================================================================
// IPC INPUT SCHEMAS
// ============================================================================

export const ThreadPatchSchema = z.object({
  title: z.string().optional(),
  pinned: z.boolean().optional(),
  systemPrompt: z.string().nullable().optional(),
})
export type ThreadPatch = z.infer<typeof ThreadPatchSchema>

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
  modelId: z.string(),
  providerId: z.string(),
  attachments: z.array(AttachmentInputSchema).optional(),
  reasoning: z.string().optional(),
})
export type UpdateMessageInput = z.infer<typeof UpdateMessageInputSchema>

export const ChatOptionsSchema = z.object({
  model: z.string(),
})
export type ChatOptions = z.infer<typeof ChatOptionsSchema>

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

/**
 * Recursive thread type for events - threads can contain other threads (folders).
 */
export type Thread = {
  id: string
  title: string
  pinned: boolean
  systemPrompt: string | null
  createdAt: string
  updatedAt: string
  children: Thread[]
}

export const ThreadSchema: z.ZodType<Thread> = z.object({
  id: z.string(),
  title: z.string(),
  pinned: z.boolean(),
  systemPrompt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  children: z.lazy(() => z.array(ThreadSchema)).default([]),
})

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

/** Thread lifecycle events (Rule 3: Push) */
export type ThreadEvent =
  | { type: 'created'; thread: Thread }
  | { type: 'updated'; thread: Thread }
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

/** Thread context menu input parameters */
export interface ThreadContextMenuParams {
  isPinned: boolean
  isInFolder: boolean
  folders: Array<{ id: string; title: string }>
}

/**
 * Thread context menu result - ALL actions returned to caller.
 * Renderer uses this to determine which domain IPC to call.
 */
export type ThreadContextMenuResult =
  | 'rename'
  | 'togglePin'
  | 'delete'
  | 'newFolder'
  | 'removeFromFolder'
  | `moveToFolder:${string}`
  | null

// ============================================================================
// FILE OPERATIONS
// ============================================================================

export const SaveDialogOptionsSchema = z.object({
  defaultPath: z.string().optional(),
  filters: z.array(z.object({
    name: z.string(),
    extensions: z.array(z.string()),
  })).optional(),
})
export type SaveDialogOptions = z.infer<typeof SaveDialogOptionsSchema>

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
  /** Thread resource operations */
  threads: {
    /** List all threads (Rule 2: Two-Way) */
    list(): Promise<ThreadSummary[]>

    /** Update thread properties (Rule 2: Two-Way) */
    update(id: string, patch: ThreadPatch): Promise<Thread>

    /** Delete a thread (Rule 2: Two-Way) */
    delete(id: string): Promise<void>

    /** Subscribe to thread lifecycle events (Rule 3: Push) */
    onEvent(callback: (event: ThreadEvent) => void): Unsubscribe
  }

  /** Folder operations for organizing threads */
  folders: {
    /** Create a folder from two threads (Rule 2: Two-Way) */
    create(name: string, thread1Id: string, thread2Id: string): Promise<ThreadSummary>

    /** Create a folder containing a single thread (Rule 2: Two-Way) */
    createWithThread(threadId: string): Promise<ThreadSummary>

    /** Move a thread into a folder (Rule 2: Two-Way) */
    moveThread(threadId: string, folderId: string): Promise<void>

    /** Move a thread out of its folder to root (Rule 2: Two-Way) */
    moveToRoot(threadId: string): Promise<void>

    /** Reorder threads within a folder (Rule 2: Two-Way) */
    reorder(folderId: string, orderedChildIds: string[]): Promise<void>
  }

  /** Message resource operations */
  messages: {
    /** List messages for a thread with branch info (Rule 2: Two-Way) */
    list(threadId: string): Promise<ListMessagesResult>

    /**
     * Create a new message (Rule 2: Two-Way)
     * Auto-creates thread if it doesn't exist, triggering a
     * threads.onEvent('created') event.
     */
    create(threadId: string, input: CreateMessageInput): Promise<Message>

    /**
     * Create a new branch (Rule 2: Two-Way)
     * Used for "edit and regenerate" flow - creates new branch, preserves old thread.
     */
    createBranch(threadId: string, input: CreateBranchInput): Promise<CreateBranchResult>

    /**
     * Update an existing message's content (Rule 2: Two-Way)
     * Used for editing assistant messages in place without regeneration.
     */
    update(threadId: string, messageId: string, input: UpdateMessageInput): Promise<Message>
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
    chat(threadId: string, options: ChatOptions): Promise<ChatResponse>

    /** Cancel an active stream (Rule 2: Two-Way) */
    stop(streamId: string): Promise<void>

    /** Subscribe to all AI stream events (Rule 3: Push) */
    onEvent(callback: (event: AIStreamEvent) => void): Unsubscribe
  }

  /** Settings key-value store */
  settings: {
    /** Get a setting value (Rule 2: Two-Way) */
    get<T = unknown>(key: string): Promise<T | null>

    /** Set a setting value (Rule 2: Two-Way) */
    set<T = unknown>(key: string, value: T): Promise<void>
  }

  /** Native UI operations */
  ui: {
    /**
     * Show thread context menu (Rule 2: Two-Way)
     * Returns the selected action. Renderer calls appropriate domain IPC based on action.
     */
    showThreadContextMenu(params: ThreadContextMenuParams): Promise<ThreadContextMenuResult>

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
    getThreadAttachmentPath(threadId: string, relativePath: string): Promise<string>
  }

  /** Logging utilities (Rule 1: One-Way) */
  log: {
    /** Send error to main process for file logging in production */
    error(tag: string, message: string, stack?: string): void
  }

  /** File operations */
  files: {
    /** Show native save dialog, returns selected file path or null if cancelled */
    showSaveDialog(options: SaveDialogOptions): Promise<string | null>

    /** Write content to a file */
    writeFile(filePath: string, content: string): Promise<void>
  }
}

declare global {
  interface Window {
    arc: ArcAPI
  }
}
