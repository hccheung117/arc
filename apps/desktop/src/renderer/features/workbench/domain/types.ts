import type { Message, MessageRole } from '@arc-types/messages'
import type { BranchInfo, AttachmentInput, ThreadConfig } from '@main/contracts/messages'
import type { Model } from '@arc-types/models'

/**
 * Branch selection state: maps parentId (or 'root') to selected child index
 */
export type BranchSelections = Record<string, number>

/**
 * Result of resolving the message tree path
 */
export interface TreeResolution {
  /** Messages along the selected path */
  path: Message[]
  /** Branch points encountered along the path */
  branchPoints: BranchInfo[]
}

/**
 * Streaming state machine
 *
 * Represents the lifecycle of an AI response stream:
 * idle → streaming → complete | error
 */
export type StreamState =
  | { status: 'idle' }
  | {
      status: 'streaming'
      id: string
      content: string
      reasoning: string
      isThinking: boolean
    }
  | { status: 'complete'; message: Message }
  | { status: 'error'; error: string }

/**
 * Source of editing operation
 * Discriminates between message edits and system prompt edits
 */
export type EditSource =
  | { kind: 'user-message'; id: string }
  | { kind: 'assistant-message'; id: string }
  | { kind: 'system-prompt' }

/**
 * Store-level editing state
 * Includes role for message edits (used by send flows)
 */
export type EditingState =
  | { kind: 'user-message'; id: string; role: 'user' }
  | { kind: 'assistant-message'; id: string; role: 'assistant' }
  | { kind: 'system-prompt' }

/**
 * Local attachment state for preview
 */
export interface ComposerAttachment {
  id: string
  file: File
  preview: string // data: URL for immediate display
  mimeType: string
}

/**
 * Context for sending a new message
 */
export interface SendNewContext {
  threadId: string
  content: string
  parentId: string | null
  model: Model
  attachments?: AttachmentInput[]
  threadConfig?: ThreadConfig
}

/**
 * Context for editing an existing message
 */
export interface EditContext {
  threadId: string
  messageId: string
  content: string
  role: MessageRole
  parentId: string | null
  model: Model
  attachments?: AttachmentInput[]
  /** Original message (for assistant edits that need modelId/providerId) */
  originalMessage?: Message
  threadConfig?: ThreadConfig
}

/**
 * Result of a send/edit operation
 *
 * Domain layer handles persistence only. Streaming is UI-owned.
 */
export interface SendResult {
  /** The user message that was created */
  userMessage?: Message
  /** Updated messages after the operation */
  messages: Message[]
  /** New branch selection if a branch was created */
  newBranchSelection?: { parentId: string | null; index: number }
}

/**
 * Display-ready message with embedded UI state
 *
 * Uses composition over inheritance to separate domain (Message)
 * from presentation concerns (isStreaming, isEditing).
 */
export interface DisplayMessage {
  message: Message
  isStreaming: boolean
  isEditing: boolean
}

/**
 * Unified input state machine
 *
 * Instead of separate isStreaming/isEditing flags, one discriminated union
 * surfaces the relevant actions for each mode.
 */
export type InputMode =
  | { mode: 'ready' }
  | { mode: 'sending' }
  | { mode: 'streaming'; stop: () => void }
  | { mode: 'editing'; source: EditSource; cancel: () => void }
