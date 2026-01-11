import type { Message, MessageRole } from '@arc-types/messages'
import type {
  AIStreamEvent,
  AttachmentInput,
  ChatResponse,
  Unsubscribe,
  ListMessagesResult,
  CreateBranchResult,
  ThreadConfig,
} from '@arc-types/arc-api'

export async function getMessages(conversationId: string): Promise<ListMessagesResult> {
  return window.arc.messages.list(conversationId)
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
  return window.arc.messages.create(conversationId, {
    role,
    content,
    parentId,
    attachments,
    modelId,
    providerId,
    threadConfig,
  })
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
  return window.arc.messages.createBranch(conversationId, {
    parentId,
    content,
    attachments,
    modelId,
    providerId,
    threadConfig,
  })
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
  return window.arc.messages.update(conversationId, messageId, {
    content,
    modelId,
    providerId,
    attachments,
    reasoning,
  })
}

export async function startAIChat(conversationId: string, model: string): Promise<ChatResponse> {
  return window.arc.ai.chat(conversationId, { model })
}

export async function stopAIChat(streamId: string): Promise<void> {
  return window.arc.ai.stop(streamId)
}

export function onAIEvent(callback: (event: AIStreamEvent) => void): Unsubscribe {
  return window.arc.ai.onEvent(callback)
}
