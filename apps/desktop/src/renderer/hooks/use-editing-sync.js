import { useEffect, useCallback } from 'react'
import { getEditableContent } from '@renderer/lib/prompts'

/**
 * Syncs composer content with editing state and provides cancel handler.
 *
 * When entering edit mode, populates composer with the content being edited
 * (either a message or system prompt) and focuses it.
 */
export function useEditingSync(
  input,
  messages,
  prompt,
  persona,
  composerRef,
) {
  // Sync composer content when entering edit mode
  useEffect(() => {
    if (input.mode !== 'editing') return
    const { source } = input

    if (source.kind === 'system-prompt') {
      const content = getEditableContent(prompt, persona)
      // If null (protected), don't populate composer - caller handles UI
      if (content !== null) {
        composerRef.current?.setMessage(content)
      }
    } else {
      const dm = messages.find((dm) => dm.message.id === source.id)
      if (dm) composerRef.current?.setMessage(dm.message.content)
    }
    composerRef.current?.focus()
  }, [input, messages, prompt, persona, composerRef])

  const cancel = useCallback(() => {
    if (input.mode === 'editing') input.cancel()
    composerRef.current?.setMessage('')
  }, [input, composerRef])

  return { cancel }
}
