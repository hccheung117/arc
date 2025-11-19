import type { ConversationSummary, ContextMenuAction } from '@arc/contracts/src/conversations'
import { getIPC } from './ipc'

export async function getConversationSummaries(): Promise<ConversationSummary[]> {
  return getIPC().getConversationSummaries()
}

export async function deleteConversation(conversationId: string): Promise<void> {
  return getIPC().deleteConversation(conversationId)
}

export async function renameConversation(conversationId: string, title: string): Promise<void> {
  return getIPC().renameConversation(conversationId, title)
}

export async function toggleConversationPin(conversationId: string, pinned: boolean): Promise<void> {
  return getIPC().togglePin(conversationId, pinned)
}

export async function showThreadContextMenu(currentPinnedState: boolean): Promise<ContextMenuAction> {
  return getIPC().showThreadContextMenu(currentPinnedState)
}
