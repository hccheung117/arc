import { forwardRef } from 'react'
import { Composer, type ComposerRef, type ComposerProps } from './composer'

interface ChatFooterProps {
  error: string | null
  composerProps: Omit<ComposerProps, 'ref'>
}

/**
 * Footer area for chat view containing error banner and composer.
 * Owns horizontal inset (px-6) to match content column alignment.
 */
export const ChatFooter = forwardRef<ComposerRef, ChatFooterProps>(
  ({ error, composerProps }, ref) => {
    return (
      <div className="shrink-0 p-chat-shell">
        {error && (
          <div className="mb-2 rounded-md bg-destructive/10 px-3 py-2 text-label text-destructive select-text cursor-text">
            {error}
          </div>
        )}
        <Composer ref={ref} {...composerProps} />
      </div>
    )
  }
)
ChatFooter.displayName = 'ChatFooter'
