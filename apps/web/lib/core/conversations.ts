import type { ConversationSummary } from '@arc/contracts/src/conversations'
import { getIPC } from './ipc'

export async function getConversationSummaries(): Promise<ConversationSummary[]> {
  return getIPC().getConversationSummaries()
}
