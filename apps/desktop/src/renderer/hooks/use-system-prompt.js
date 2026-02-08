import { useCallback } from 'react'

/**
 * Manages system prompt editing and persistence.
 *
 * Handles:
 * - Starting edit mode (blocked during streaming)
 * - Saving to local (owner='local') or backend (owner='db') threads
 * - Protected prompts (read-only, editing shows description only)
 *
 * Note: Auto-persist is no longer needed. Thread config is bundled with the
 * first message during ownership handoff (see use-chat-session.js).
 */
export function useSystemPrompt(
  thread,
  promptInfo,
  input,
  onThreadUpdate,
  composerRef,
  startEditSystemPrompt,
) {
  const startEdit = useCallback(() => {
    if (input.mode === 'streaming' || input.mode === 'sending') return
    startEditSystemPrompt()
  }, [input.mode, startEditSystemPrompt])

  const save = useCallback(
    async (content) => {
      // Protected prompts cannot be modified
      if (promptInfo.isProtected) {
        if (input.mode === 'editing') input.cancel()
        composerRef.current?.setMessage('')
        return
      }

      // Convert content to Prompt
      const newPrompt = content.trim()
        ? { type: 'inline', content: content.trim() }
        : { type: 'none' }

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
