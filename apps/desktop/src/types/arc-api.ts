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

import type { Message, MessageRole, MessageContextMenuAction } from './messages'
import type { ConversationSummary, ContextMenuAction } from './conversations'
import type { Model } from './models'
import type {
  ArcImportEvent,
  ProfileInfo,
  ProfileInstallResult,
  ProfilesEvent,
} from './arc-file'

/** Cleanup function returned by event subscriptions */
export type Unsubscribe = () => void

/** Full conversation entity (returned by update operations) */
export interface Conversation {
  readonly id: string
  readonly title: string
  readonly pinned: boolean
  readonly createdAt: string
  readonly updatedAt: string
}

/** Partial update payload for conversations */
export interface ConversationPatch {
  title?: string
  pinned?: boolean
}

/** Conversation lifecycle events (Rule 3: Push) */
export type ConversationEvent =
  | { type: 'created'; conversation: Conversation }
  | { type: 'updated'; conversation: Conversation }
  | { type: 'deleted'; id: string }

/** Attachment input payload (base64 encoded for IPC transport) */
export interface AttachmentInput {
  type: 'image'
  data: string // Base64-encoded image data
  mimeType: string
  name?: string // Original filename (optional)
}

/** Message creation payload */
export interface CreateMessageInput {
  role: MessageRole
  content: string
  parentId: string | null
  attachments?: AttachmentInput[]
  modelId: string
  providerId: string
}

/** Branch info for UI navigation */
export interface BranchInfo {
  parentId: string | null
  branches: string[]
  currentIndex: number
}

/** Result of listing messages with branch info */
export interface ListMessagesResult {
  messages: Message[]
  branchPoints: BranchInfo[]
}

/** Create branch payload (for edit flow) */
export interface CreateBranchInput {
  parentId: string | null
  content: string
  attachments?: AttachmentInput[]
  modelId: string
  providerId: string
}

/** Create branch result */
export interface CreateBranchResult {
  message: Message
  branchPoints: BranchInfo[]
}

/** Switch branch result */
export interface SwitchBranchResult {
  messages: Message[]
  branchPoints: BranchInfo[]
}

/** AI chat options */
export interface ChatOptions {
  model: string
}

/** AI chat response with stream handle */
export interface ChatResponse {
  streamId: string
}

/** AI stream events (IPC-safe: error is string, not Error object) */
export type AIStreamEvent =
  | { type: 'delta'; streamId: string; chunk: string }
  | { type: 'reasoning'; streamId: string; chunk: string }
  | { type: 'complete'; streamId: string; message: Message }
  | { type: 'error'; streamId: string; error: string }

/** Models cache update events (Rule 3: Push) */
export type ModelsEvent = { type: 'updated' }

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
     * Switch to a different branch (Rule 2: Two-Way)
     * Returns messages along the new active path.
     */
    switchBranch(
      conversationId: string,
      branchParentId: string | null,
      targetBranchIndex: number,
    ): Promise<SwitchBranchResult>
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
    /** Show thread context menu (Rule 2: Two-Way) */
    showThreadContextMenu(isPinned: boolean): Promise<ContextMenuAction>
    
    /** Show message context menu (Rule 2: Two-Way) */
    showMessageContextMenu(content: string, hasEditOption: boolean): Promise<MessageContextMenuAction>
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

  /** .arc file import operations (Legacy - redirects to profiles) */
  import: {
    /** Import .arc file from path (Rule 2: Two-Way) */
    file(filePath: string): Promise<ProfileInstallResult>

    /** Subscribe to import events (Rule 3: Push) */
    onEvent(callback: (event: ArcImportEvent) => void): Unsubscribe
  }

  /** Electron utilities exposed to renderer */
  utils: {
    /** Get file path from a dropped File object */
    getFilePath(file: File): string

    /** Open a file with the native OS viewer */
    openFile(filePath: string): Promise<void>

    /** Get absolute path for an attachment */
    getAttachmentPath(conversationId: string, relativePath: string): Promise<string>
  }
}

declare global {
  interface Window {
    arc: ArcAPI
  }
}
