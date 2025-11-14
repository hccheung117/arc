import type { Message } from '@arc/contracts/src/messages'
import { getIPC } from './ipc'

export async function getMessages(conversationId: string): Promise<Message[]> {
  return getIPC().getMessages(conversationId)
}

export async function addUserMessage(
  conversationId: string,
  content: string,
): Promise<Message> {
  return getIPC().addUserMessage(conversationId, content)
}

export async function addAssistantMessage(
  conversationId: string,
  content: string,
): Promise<Message> {
  return getIPC().addAssistantMessage(conversationId, content)
}
