import { useCallback } from 'react'

/**
 * Provides export functionality for chat messages.
 * Delegates to messages module which handles formatting, dialog, and file write.
 */
export function useExport(threadId: string) {
  return useCallback(async () => {
    await window.arc.messages.export({ threadId })
  }, [threadId])
}
