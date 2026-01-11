import { useEffect, useCallback, type RefObject } from 'react'
import type { InputMode, DisplayMessage } from '@renderer/features/workbench/domain/types'
import type { ComposerRef } from '@renderer/features/workbench/components/composer'

/**
 * Syncs composer content with editing state and provides cancel handler.
 *
 * When entering edit mode, populates composer with the content being edited
 * (either a message or system prompt) and focuses it.
 */
export function useEditingSync(
  input: InputMode,
  messages: DisplayMessage[],
  systemPrompt: string | null,
  composerRef: RefObject<ComposerRef | null>,
) {
  // Sync composer content when entering edit mode
  useEffect(() => {
    if (input.mode !== 'editing') return
    const { source } = input

    if (source.kind === 'system-prompt') {
      composerRef.current?.setMessage(systemPrompt ?? '')
    } else {
      const dm = messages.find((dm) => dm.message.id === source.id)
      if (dm) composerRef.current?.setMessage(dm.message.content)
    }
    composerRef.current?.focus()
  }, [input, messages, systemPrompt, composerRef])

  const cancel = useCallback(() => {
    if (input.mode === 'editing') input.cancel()
    composerRef.current?.setMessage('')
  }, [input, composerRef])

  return { cancel }
}
