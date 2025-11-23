import type { Message } from '../../../types/messages'
import { getIPC } from './ipc'

export async function getMessages(conversationId: string): Promise<Message[]> {
  return getIPC().getMessages(conversationId)
}

export async function streamMessage(
  conversationId: string,
  model: string,
  content: string,
): Promise<{ streamId: string; messageId: string }> {
  return getIPC().streamMessage(conversationId, model, content)
}

export async function cancelStream(streamId: string): Promise<void> {
  return getIPC().cancelStream(streamId)
}

export function onStreamDelta(callback: (event: { streamId: string; chunk: string }) => void) {
  return getIPC().onStreamDelta(callback)
}

export function onStreamComplete(callback: (event: { streamId: string; message: Message }) => void) {
  return getIPC().onStreamComplete(callback)
}

export function onStreamError(callback: (event: { streamId: string; error: string }) => void) {
  return getIPC().onStreamError(callback)
}
