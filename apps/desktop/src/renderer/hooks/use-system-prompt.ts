import { useCallback, type RefObject } from 'react'
import type { ChatThread, ThreadAction } from '@renderer/lib/threads'
import type { InputMode } from '@renderer/lib/types'
import type { ComposerRef } from '@renderer/components/composer'
import type { PromptInfo } from '@renderer/lib/prompts'

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
 * - Protected prompts (read-only, editing shows description only)
 *
 * Note: Auto-persist is no longer needed. Thread config is bundled with the
 * first message during ownership handoff (see use-chat-session.ts).
 */
export function useSystemPrompt(
  thread: ChatThread,
  promptInfo: PromptInfo,
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
      // Protected prompts cannot be modified
      if (promptInfo.isProtected) {
        if (input.mode === 'editing') input.cancel()
        composerRef.current?.setMessage('')
        return
      }

      // Convert content to Prompt
      const newPrompt = content.trim()
        ? { type: 'inline' as const, content: content.trim() }
        : { type: 'none' as const }

      if (thread.owner === 'local') {
        // Local ownership: update local state
        onThreadUpdate({
          type: 'PATCH',
          id: thread.id,
          patch: { prompt: newPrompt },
        })
      } else {
        // DB ownership: save to backend immediately
        await window.arc.threads.update({
          threadId: thread.id,
          patch: { prompt: newPrompt },
        })
      }

      // Clear editing state
      if (input.mode === 'editing') input.cancel()
      composerRef.current?.setMessage('')
    },
    [thread.id, thread.owner, onThreadUpdate, input, composerRef, promptInfo.isProtected],
  )

  return { startEdit, save }
}
