import { useEffect, useRef } from 'react'

const STORAGE_KEY = 'arc:activeStream'

interface PendingStream {
  threadId: string
  modelId: string
}

interface UseStreamResumeOptions {
  threadId: string
  modelId: string | undefined
  onResume: (threadId: string, modelId: string) => void
}

/**
 * Resume pending streams from session storage
 *
 * Handles the edge case where a stream was started but the component
 * unmounted before completion (e.g., empty state quick-send).
 */
export function useStreamResume({ threadId, modelId, onResume }: UseStreamResumeOptions) {
  const hasResumed = useRef(false)

  useEffect(() => {
    if (hasResumed.current) return

    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return

    try {
      const pending: PendingStream = JSON.parse(raw)
      if (pending.threadId === threadId) {
        hasResumed.current = true
        sessionStorage.removeItem(STORAGE_KEY)
        onResume(threadId, modelId || pending.modelId)
      }
    } catch {
      sessionStorage.removeItem(STORAGE_KEY)
    }
  }, [threadId, modelId, onResume])
}
