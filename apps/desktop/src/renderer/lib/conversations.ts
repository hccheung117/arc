import type { ConversationSummary } from '@arc-types/conversations'
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

export function onConversationEvent(callback: (event: ConversationEvent) => void): Unsubscribe {
  return window.arc.conversations.onEvent(callback)
}

/**
 * Shows thread context menu. Data actions (delete, togglePin) are handled in main.
 * Returns 'rename' for UI-only action, or null otherwise.
 */
export async function showThreadContextMenu(
  threadId: string,
  isPinned: boolean
): Promise<'rename' | null> {
  return window.arc.ui.showThreadContextMenu(threadId, isPinned)
}
