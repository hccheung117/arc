import { useEffect, useCallback, type RefObject } from 'react'
import type { PromptSource } from '@main/modules/threads/json-file'
import type { Persona } from '@contracts/personas'
import type { InputMode, DisplayMessage } from '@renderer/lib/types'
import type { ComposerRef } from '@renderer/components/composer'
import { getEditableContent } from '@renderer/lib/prompts'

/**
 * Syncs composer content with editing state and provides cancel handler.
 *
 * When entering edit mode, populates composer with the content being edited
 * (either a message or system prompt) and focuses it.
 */
export function useEditingSync(
  input: InputMode,
  messages: DisplayMessage[],
  promptSource: PromptSource,
  persona: Persona | undefined,
  composerRef: RefObject<ComposerRef | null>,
) {
  // Sync composer content when entering edit mode
  useEffect(() => {
    if (input.mode !== 'editing') return
    const { source } = input

    if (source.kind === 'system-prompt') {
      const content = getEditableContent(promptSource, persona)
      // If null (protected), don't populate composer - caller handles UI
      if (content !== null) {
        composerRef.current?.setMessage(content)
      }
    } else {
      const dm = messages.find((dm) => dm.message.id === source.id)
      if (dm) composerRef.current?.setMessage(dm.message.content)
    }
    composerRef.current?.focus()
  }, [input, messages, promptSource, persona, composerRef])

  const cancel = useCallback(() => {
    if (input.mode === 'editing') input.cancel()
    composerRef.current?.setMessage('')
  }, [input, composerRef])

  return { cancel }
}
