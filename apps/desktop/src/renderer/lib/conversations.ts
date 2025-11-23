import type { ConversationSummary, ContextMenuAction } from '@arc-types/conversations'
import type { Conversation, ConversationPatch, ConversationEvent, Unsubscribe } from '@arc-types/arc-api'

export async function getConversationSummaries(): Promise<ConversationSummary[]> {
  return window.arc.conversations.list()
}

export async function updateConversation(id: string, patch: ConversationPatch): Promise<Conversation> {
  return window.arc.conversations.update(id, patch)
}

export async function deleteConversation(conversationId: string): Promise<void> {
  return window.arc.conversations.delete(conversationId)
}

export async function renameConversation(conversationId: string, title: string): Promise<void> {
  await window.arc.conversations.update(conversationId, { title })
}

export async function toggleConversationPin(conversationId: string, pinned: boolean): Promise<void> {
  await window.arc.conversations.update(conversationId, { pinned })
}

export function onConversationEvent(callback: (event: ConversationEvent) => void): Unsubscribe {
  return window.arc.conversations.onEvent(callback)
}

export async function showThreadContextMenu(currentPinnedState: boolean): Promise<ContextMenuAction> {
  return window.arc.ui.showThreadContextMenu(currentPinnedState)
}
