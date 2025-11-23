import type { ConversationSummary, ContextMenuAction } from '../../../types/conversations'
import type { Conversation, ConversationPatch, ConversationEvent, Unsubscribe } from '../../../types/arc-api'
import { getArc } from './ipc'

export async function getConversationSummaries(): Promise<ConversationSummary[]> {
  return getArc().conversations.list()
}

export async function updateConversation(id: string, patch: ConversationPatch): Promise<Conversation> {
  return getArc().conversations.update(id, patch)
}

export async function deleteConversation(conversationId: string): Promise<void> {
  return getArc().conversations.delete(conversationId)
}

export async function renameConversation(conversationId: string, title: string): Promise<void> {
  await getArc().conversations.update(conversationId, { title })
}

export async function toggleConversationPin(conversationId: string, pinned: boolean): Promise<void> {
  await getArc().conversations.update(conversationId, { pinned })
}

export function onConversationEvent(callback: (event: ConversationEvent) => void): Unsubscribe {
  return getArc().conversations.onEvent(callback)
}

export async function showThreadContextMenu(currentPinnedState: boolean): Promise<ContextMenuAction> {
  return getArc().ui.showThreadContextMenu(currentPinnedState)
}
