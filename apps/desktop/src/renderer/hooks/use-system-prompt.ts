import { useCallback, type RefObject } from 'react'
import type { ChatThread, ThreadAction } from '@renderer/lib/threads'
import type { InputMode } from '@renderer/lib/types'
import type { ComposerRef } from '@renderer/components/composer'

interface SystemPromptActions {
  startEdit: () => void
  save: (content: string) => Promise<void>
}

/**
 * Manages system prompt editing and persistence.
 *
 * Handles:
 * - Starting edit mode (blocked during streaming)
 * - Saving to local (owner='local') or backend (owner='db') threads
 *
 * Note: Auto-persist is no longer needed. Thread config is bundled with the
 * first message during ownership handoff (see use-chat-session.ts).
 */
export function useSystemPrompt(
  thread: ChatThread,
  input: InputMode,
  onThreadUpdate: (action: ThreadAction) => void,
  composerRef: RefObject<ComposerRef | null>,
  startEditSystemPrompt: () => void,
): SystemPromptActions {
  const startEdit = useCallback(() => {
    if (input.mode === 'streaming' || input.mode === 'sending') return
    startEditSystemPrompt()
  }, [input.mode, startEditSystemPrompt])

  const save = useCallback(
    async (content: string) => {
      const newSystemPrompt = content.trim() || null

      if (thread.owner === 'local') {
        // Local ownership: update local state only, config bundled with first message
        onThreadUpdate({ type: 'PATCH', id: thread.id, patch: { systemPrompt: newSystemPrompt } })
      } else {
        // DB ownership: save to backend immediately
        await window.arc.threads.update({ threadId: thread.id, patch: { systemPrompt: newSystemPrompt } })
      }

      // Clear editing state
      if (input.mode === 'editing') input.cancel()
      composerRef.current?.setMessage('')
    },
    [thread.id, thread.owner, onThreadUpdate, input, composerRef],
  )

  return { startEdit, save }
}
