import { useState, useCallback } from 'react'
import type { MessageRole } from '@arc-types/messages'
import type { EditingState } from '@renderer/features/workbench/chat/domain/types'

interface UseEditingReturn {
  editingState: EditingState | null
  isEditing: boolean
  startEdit: (messageId: string, role: MessageRole) => void
  cancelEdit: () => void
  clearEdit: () => void
}

/**
 * Manage editing state for message modification
 */
export function useEditing(): UseEditingReturn {
  const [editingState, setEditingState] = useState<EditingState | null>(null)

  const startEdit = useCallback((messageId: string, role: MessageRole) => {
    setEditingState({ messageId, role })
  }, [])

  const cancelEdit = useCallback(() => {
    setEditingState(null)
  }, [])

  const clearEdit = useCallback(() => {
    setEditingState(null)
  }, [])

  return {
    editingState,
    isEditing: editingState !== null,
    startEdit,
    cancelEdit,
    clearEdit,
  }
}
