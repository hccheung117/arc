import type { Message, MessageStreamHandle } from '@arc/contracts/src/messages'
import { getIPC } from './ipc'

export async function getMessages(conversationId: string): Promise<Message[]> {
  return getIPC().getMessages(conversationId)
}

export async function addUserMessage(
  conversationId: string,
  content: string
): Promise<Message> {
  return getIPC().addUserMessage(conversationId, content)
}

export function streamAssistantMessage(
  conversationId: string,
  content: string
): MessageStreamHandle {
  return getIPC().streamAssistantMessage(conversationId, content)
}
