import type { AIStreamEvent, Unsubscribe } from '@contracts/events'
import type {
  AttachmentInput,
  ThreadConfig,
  BranchInfo,
  Message as StoredMessage,
  MessageRole,
} from '@contracts/messages'
import type { ChatResponse } from '@contracts/ai'

// ============================================================================
// RENDERER VIEW MODEL TYPES
// ============================================================================

/**
 * Message attachment with URL for display.
 *
 * This is a renderer ViewModel - IPC returns StoredAttachment (no url).
 * URL is generated during transformation based on conversationId.
 */
export interface MessageAttachment {
  type: 'image'
  path: string
  mimeType: string
  url: string
}

/**
 * Message ViewModel for UI rendering.
 *
 * This is a renderer ViewModel - IPC returns StoredMessageEvent (optional fields).
 * Key differences from IPC type:
 * - Has conversationId (derived from context)
 * - Has url on attachments (generated)
 * - Has status field (for streaming state)
 * - All fields required (defaults applied during transformation)
 */
export interface Message {
  id: string
  conversationId: string
  role: MessageRole
  status: MessageStatus
  content: string
  reasoning?: string
  createdAt: string
  updatedAt: string
  parentId: string | null
  error?: Error
  attachments?: MessageAttachment[]
  modelId?: string
  providerId?: string
}

export type MessageStatus = 'pending' | 'streaming' | 'complete' | 'failed'

export type { MessageRole }

// ============================================================================
// TRANSFORMATION
// ============================================================================

/**
 * Transform IPC message (StoredMessageEvent) to UI view model (Message).
 *
 * IPC returns storage format (event sourcing, optional fields).
 * UI expects view model format (required fields, conversationId).
 */
function toMessage(stored: StoredMessage, conversationId: string): Message {
  return {
    id: stored.id,
    conversationId,
    role: stored.role ?? 'user',
    status: 'complete',
    content: stored.content ?? '',
    reasoning: stored.reasoning,
    createdAt: stored.createdAt ?? new Date().toISOString(),
    updatedAt: stored.updatedAt ?? new Date().toISOString(),
    parentId: stored.parentId ?? null,
    attachments: stored.attachments?.map((a) => ({
      type: a.type,
      path: a.path,
      mimeType: a.mimeType,
      url: `arc://attachment/${conversationId}/${a.path}`,
    })),
    modelId: stored.modelId,
    providerId: stored.providerId,
  }
}

// ============================================================================
// RESULT TYPES (UI-compatible)
// ============================================================================

export interface ListMessagesResult {
  messages: Message[]
  branchPoints: BranchInfo[]
}

export interface CreateBranchResult {
  message: Message
  branchPoints: BranchInfo[]
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

export async function getMessages(conversationId: string): Promise<ListMessagesResult> {
  const result = await window.arc.messages.list({ threadId: conversationId })
  return {
    messages: result.messages.map((m) => toMessage(m, conversationId)),
    branchPoints: result.branchPoints,
  }
}

export async function createMessage(
  conversationId: string,
  role: MessageRole,
  content: string,
  parentId: string | null,
  modelId: string,
  providerId: string,
  attachments?: AttachmentInput[],
  threadConfig?: ThreadConfig,
): Promise<Message> {
  const stored = await window.arc.messages.create({
    threadId: conversationId,
    input: {
      role,
      content,
      parentId,
      attachments,
      modelId,
      providerId,
      threadConfig,
    },
  })
  return toMessage(stored, conversationId)
}

export async function createBranch(
  conversationId: string,
  parentId: string | null,
  content: string,
  modelId: string,
  providerId: string,
  attachments?: AttachmentInput[],
  threadConfig?: ThreadConfig,
): Promise<CreateBranchResult> {
  const result = await window.arc.messages.createBranch({
    threadId: conversationId,
    input: {
      parentId,
      content,
      attachments,
      modelId,
      providerId,
      threadConfig,
    },
  })
  return {
    message: toMessage(result.message, conversationId),
    branchPoints: result.branchPoints,
  }
}

export async function updateMessage(
  conversationId: string,
  messageId: string,
  content: string,
  modelId: string,
  providerId: string,
  attachments?: AttachmentInput[],
  reasoning?: string,
): Promise<Message> {
  const stored = await window.arc.messages.update({
    threadId: conversationId,
    messageId,
    input: {
      content,
      modelId,
      providerId,
      attachments,
      reasoning,
    },
  })
  return toMessage(stored, conversationId)
}

export async function startAIChat(conversationId: string, model: string): Promise<ChatResponse> {
  return window.arc.ai.chat({ threadId: conversationId, model })
}

export async function stopAIChat(streamId: string): Promise<void> {
  return window.arc.ai.stop({ streamId })
}

export async function startRefine(prompt: string, model: string): Promise<ChatResponse> {
  return window.arc.ai.refine({ prompt, model })
}

/**
 * Transform stored message to UI message.
 *
 * Exported for use by stream-manager when handling AIStreamEvent completion.
 * The threadId must be tracked separately since events don't include it.
 */
export function transformMessage(stored: StoredMessage, conversationId: string): Message {
  return toMessage(stored, conversationId)
}

export function onAIEvent(callback: (event: AIStreamEvent) => void): Unsubscribe {
  return window.arc.ai.onEvent(callback)
}
