import { useState, useEffect, useCallback } from 'react'
import { createId } from '@paralleldrive/cuid2'
import { onThreadEvent } from '@renderer/lib/threads'
import type { ThreadAction } from '@renderer/features/workbench/use-chat-threads'

interface UseActiveThreadReturn {
  activeThreadId: string | null
  select: (id: string | null) => void
}

/**
 * Manages active thread selection with auto-initialization.
 *
 * - Creates a draft thread on startup if none selected
 * - Clears selection when active thread is deleted
 */
export function useActiveThread(dispatch: (action: ThreadAction) => void): UseActiveThreadReturn {
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)

  // Auto-create draft thread on startup
  useEffect(() => {
    if (activeThreadId !== null) return

    const id = createId()
    dispatch({ type: 'CREATE_DRAFT', id })
    setActiveThreadId(id)
  }, [activeThreadId, dispatch])

  // Deselect if active thread is deleted
  useEffect(() => {
    return onThreadEvent((event) => {
      if (event.type === 'deleted' && event.id === activeThreadId) {
        setActiveThreadId(null)
      }
    })
  }, [activeThreadId])

  const select = useCallback((id: string | null) => {
    setActiveThreadId(id)
  }, [])

  return { activeThreadId, select }
}
