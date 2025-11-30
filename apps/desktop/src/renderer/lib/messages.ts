import type { Message, MessageRole } from '@arc-types/messages'
import type { AIStreamEvent, AttachmentInput, ChatResponse, EditMessageResult, Unsubscribe } from '@arc-types/arc-api'

export async function getMessages(conversationId: string): Promise<Message[]> {
  return window.arc.messages.list(conversationId)
}

export async function createMessage(
  conversationId: string,
  role: MessageRole,
  content: string,
  modelId: string,
  providerId: string,
  attachments?: AttachmentInput[],
): Promise<Message> {
  return window.arc.messages.create(conversationId, { role, content, attachments, modelId, providerId })
}

export async function editMessage(
  conversationId: string,
  messageId: string,
  content: string,
): Promise<EditMessageResult> {
  return window.arc.messages.edit(conversationId, messageId, { content })
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
