import { useState, useEffect, useCallback } from 'react'
import { createDraftThread, onThreadEvent } from '@renderer/lib/threads'

/**
 * Manages active thread selection with auto-initialization.
 *
 * - Creates a draft thread on startup if none selected
 * - Clears selection when active thread is deleted
 */
export function useActiveThread(dispatch) {
  const [activeThreadId, setActiveThreadId] = useState(null)

  // Auto-create draft thread on startup
  useEffect(() => {
    if (activeThreadId !== null) return

    const draft = createDraftThread()
    dispatch({ type: 'UPSERT', thread: draft })
    setActiveThreadId(draft.id)
  }, [activeThreadId, dispatch])

  // Deselect if active thread is deleted
  useEffect(() => {
    return onThreadEvent((event) => {
      if (event.type === 'deleted' && event.id === activeThreadId) {
        setActiveThreadId(null)
      }
    })
  }, [activeThreadId])

  const select = useCallback((id) => {
    setActiveThreadId(id)
  }, [])

  return { activeThreadId, select }
}
