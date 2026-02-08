import { useCallback } from 'react'
import { useChatUIStore } from '@renderer/stores/chat-ui-store'

/**
 * Store-backed editing hook
 *
 * Reads/writes editing state from the global store.
 * State survives tab switches.
 *
 * @param threadId - The thread ID
 */
export function useEditingStore(threadId) {
  const editingState = useChatUIStore((state) => state.getThreadState(threadId).editing)
  const isSending = useChatUIStore((state) => state.getThreadState(threadId).isSending)

  const startEditMessage = useCallback(
    (messageId, role) => {
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
