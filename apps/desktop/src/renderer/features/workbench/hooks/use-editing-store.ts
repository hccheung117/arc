import { useCallback } from 'react'
import type { EditingState } from '@renderer/features/workbench/domain/types'
import { useChatUIStore } from '@renderer/features/workbench/stores/chat-ui-store'

interface UseEditingStoreReturn {
  editingState: EditingState | null
  isEditing: boolean
  isEditingMessage: boolean
  isEditingSystemPrompt: boolean
  isSending: boolean
  startEditMessage: (messageId: string, role: 'user' | 'assistant') => void
  startEditSystemPrompt: () => void
  cancelEdit: () => void
  clearEdit: () => void
  startSending: () => void
  stopSending: () => void
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
  const isSending = useChatUIStore((state) => state.getThreadState(threadId).isSending)

  const startEditMessage = useCallback(
    (messageId: string, role: 'user' | 'assistant') => {
      useChatUIStore.getState().startEditMessage(threadId, messageId, role)
    },
    [threadId],
  )

  const startEditSystemPrompt = useCallback(() => {
    useChatUIStore.getState().startEditSystemPrompt(threadId)
  }, [threadId])

  const cancelEdit = useCallback(() => {
    useChatUIStore.getState().cancelEdit(threadId)
  }, [threadId])

  const clearEdit = useCallback(() => {
    useChatUIStore.getState().cancelEdit(threadId)
  }, [threadId])

  const startSending = useCallback(() => {
    useChatUIStore.getState().startSending(threadId)
  }, [threadId])

  const stopSending = useCallback(() => {
    useChatUIStore.getState().stopSending(threadId)
  }, [threadId])

  return {
    editingState,
    isEditing: editingState !== null,
    isEditingMessage: editingState !== null && editingState.kind !== 'system-prompt',
    isEditingSystemPrompt: editingState?.kind === 'system-prompt',
    isSending,
    startEditMessage,
    startEditSystemPrompt,
    cancelEdit,
    clearEdit,
    startSending,
    stopSending,
  }
}
