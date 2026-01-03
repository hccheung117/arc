import { useCallback } from 'react'
import type { MessageRole } from '@arc-types/messages'
import type { EditingState } from '../domain/types'
import { useChatUIStore } from '../stores/chat-ui-store'

interface UseEditingStoreReturn {
  editingState: EditingState | null
  isEditing: boolean
  startEdit: (messageId: string, role: MessageRole) => void
  cancelEdit: () => void
  clearEdit: () => void
}

/**
 * Store-backed editing hook
 *
 * Reads/writes editing state from the global store.
 * State survives tab switches.
 *
 * @param threadId - The thread ID
 */
export function useEditingStore(threadId: string): UseEditingStoreReturn {
  const editingState = useChatUIStore((state) => state.getThreadState(threadId).editing)

  const startEdit = useCallback(
    (messageId: string, role: MessageRole) => {
      useChatUIStore.getState().startEdit(threadId, messageId, role)
    },
    [threadId],
  )

  const cancelEdit = useCallback(() => {
    useChatUIStore.getState().cancelEdit(threadId)
  }, [threadId])

  const clearEdit = useCallback(() => {
    useChatUIStore.getState().cancelEdit(threadId)
  }, [threadId])

  return {
    editingState,
    isEditing: editingState !== null,
    startEdit,
    cancelEdit,
    clearEdit,
  }
}
