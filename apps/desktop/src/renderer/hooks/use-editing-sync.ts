import { useEffect, useCallback, type RefObject } from 'react'
import type { InputMode, DisplayMessage } from '@renderer/lib/types'
import type { ComposerRef } from '@renderer/components/composer'
import type { PromptInfo } from '@renderer/lib/prompts'

/**
 * Syncs composer content with editing state and provides cancel handler.
 *
 * When entering edit mode, populates composer with the content being edited
 * (either a message or system prompt) and focuses it.
 *
 * Uses PromptInfo.displayContent for system prompt editing, which already
 * handles protected vs editable distinction.
 */
export function useEditingSync(
  input: InputMode,
  messages: DisplayMessage[],
  promptInfo: PromptInfo,
  composerRef: RefObject<ComposerRef | null>,
) {
  // Sync composer content when entering edit mode
  useEffect(() => {
    if (input.mode !== 'editing') return
    const { source } = input

    if (source.kind === 'system-prompt') {
      // PromptInfo.displayContent provides the right content for the prompt type
      composerRef.current?.setMessage(promptInfo.displayContent)
    } else {
      const dm = messages.find((dm) => dm.message.id === source.id)
      if (dm) composerRef.current?.setMessage(dm.message.content)
    }
    composerRef.current?.focus()
  }, [input, messages, promptInfo, composerRef])

  const cancel = useCallback(() => {
    if (input.mode === 'editing') input.cancel()
    composerRef.current?.setMessage('')
  }, [input, composerRef])

  return { cancel }
}
