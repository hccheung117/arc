import { forwardRef } from 'react'
import { Composer, type ComposerRef, type ComposerProps } from './composer'

interface ChatFooterProps {
  error: string | null
  composerProps: Omit<ComposerProps, 'ref'>
}

/**
 * Footer area for chat view containing error banner and composer.
 * Grows upward naturally; flex container constrains max height.
 */
export const ChatFooter = forwardRef<ComposerRef, ChatFooterProps>(
  ({ error, composerProps }, ref) => {
    return (
      <div className="flex flex-col min-h-0 p-chat-shell">
        {error && (
          <div className="mb-2 rounded-md bg-destructive/10 px-3 py-2 text-label text-destructive select-text cursor-text shrink-0">
            {error}
          </div>
        )}
        <Composer ref={ref} {...composerProps} />
      </div>
    )
  }
)
ChatFooter.displayName = 'ChatFooter'
