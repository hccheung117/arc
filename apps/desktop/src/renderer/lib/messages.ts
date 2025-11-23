import type { Message, MessageRole } from '../../types/messages'
import type { AIStreamEvent, ChatResponse, Unsubscribe } from '../../types/arc-api'
import { getArc } from './ipc'

export async function getMessages(conversationId: string): Promise<Message[]> {
  return getArc().messages.list(conversationId)
}

export async function createMessage(
  conversationId: string,
  role: MessageRole,
  content: string
): Promise<Message> {
  return getArc().messages.create(conversationId, { role, content })
}

export async function startAIChat(conversationId: string, model: string): Promise<ChatResponse> {
  return getArc().ai.chat(conversationId, { model })
}

export async function stopAIChat(streamId: string): Promise<void> {
  return getArc().ai.stop(streamId)
}

export function onAIEvent(callback: (event: AIStreamEvent) => void): Unsubscribe {
  return getArc().ai.onEvent(callback)
}
