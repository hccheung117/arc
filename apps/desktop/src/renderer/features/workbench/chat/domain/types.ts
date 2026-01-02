import type { Message, MessageRole } from '@arc-types/messages'
import type { BranchInfo, AttachmentInput } from '@arc-types/arc-api'
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
 * Editing state for message modification
 */
export interface EditingState {
  messageId: string
  role: MessageRole
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
}

/**
 * Result of a send/edit operation
 */
export interface SendResult {
  /** The user message that was created/edited */
  userMessage?: Message
  /** Stream ID if AI response was started */
  streamId?: string
  /** Updated messages after the operation */
  messages: Message[]
  /** New branch selection if a branch was created */
  newBranchSelection?: { parentId: string | null; index: number }
}
