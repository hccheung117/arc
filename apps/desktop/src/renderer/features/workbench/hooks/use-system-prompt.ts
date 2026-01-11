import { useCallback, useEffect, useRef, type RefObject } from 'react'
import type { ChatThread, ThreadAction } from '@renderer/lib/threads'
import type { InputMode } from '@renderer/features/workbench/domain/types'
import type { ComposerRef } from '@renderer/features/workbench/components/composer'

interface SystemPromptActions {
  startEdit: () => void
  save: (content: string) => Promise<void>
}

/**
 * Manages system prompt editing and persistence.
 *
 * Handles:
 * - Starting edit mode (blocked during streaming)
 * - Saving to draft (local) or persisted (backend) threads
 * - Auto-persisting when a draft thread becomes persisted
 */
export function useSystemPrompt(
  thread: ChatThread,
  input: InputMode,
  onThreadUpdate: (action: ThreadAction) => void,
  composerRef: RefObject<ComposerRef | null>,
  startEditSystemPrompt: () => void,
): SystemPromptActions {
  const startEdit = useCallback(() => {
    if (input.mode === 'streaming') return
    startEditSystemPrompt()
  }, [input.mode, startEditSystemPrompt])

  const save = useCallback(
    async (content: string) => {
      const newSystemPrompt = content.trim() || null

      if (thread.status === 'draft') {
        // Draft threads: update local state only, will persist when thread is created
        onThreadUpdate({ type: 'PATCH', id: thread.id, patch: { systemPrompt: newSystemPrompt } })
      } else {
        // Persisted threads: save to backend
        await window.arc.threads.update(thread.id, { systemPrompt: newSystemPrompt })
      }

      // Clear editing state
      if (input.mode === 'editing') input.cancel()
      composerRef.current?.setMessage('')
    },
    [thread.id, thread.status, onThreadUpdate, input, composerRef],
  )

  // Auto-persist system prompt when draft thread becomes persisted
  const prevStatusRef = useRef(thread.status)
  useEffect(() => {
    const wasJustPersisted = prevStatusRef.current === 'draft' && thread.status === 'persisted'
    prevStatusRef.current = thread.status

    if (wasJustPersisted && thread.systemPrompt) {
      window.arc.threads.update(thread.id, { systemPrompt: thread.systemPrompt })
    }
  }, [thread.status, thread.id, thread.systemPrompt])

  return { startEdit, save }
}
