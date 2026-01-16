import type { Message, MessageRole } from '@arc-types/messages'
import type { AIStreamEvent, Unsubscribe } from '@main/contracts/events'
import type {
  AttachmentInput,
  ThreadConfig,
  BranchInfo,
  Message as StoredMessage,
} from '@main/contracts/messages'
import type { ChatResponse } from '@main/contracts/ai'

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
