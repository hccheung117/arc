import { forwardRef, useCallback, useEffect, useRef, useState } from 'react'
import { Composer, type ComposerRef, type ComposerProps } from './composer'

interface ChatFooterProps {
  error: string | null
  composerProps: Omit<ComposerProps, 'ref'>
  maxHeight: number | undefined
  onMaxHeightChange: (maxHeight: number | undefined) => void
}

/**
 * Footer area for chat view containing error banner and composer.
 * Floats at bottom of chat body; drag handle on top edge constrains max height.
 */
export const ChatFooter = forwardRef<ComposerRef, ChatFooterProps>(
  ({ error, composerProps, maxHeight, onMaxHeightChange }, ref) => {
    const [isResizing, setIsResizing] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    const startResizing = useCallback(() => {
      setIsResizing(true)
    }, [])

    useEffect(() => {
      if (!isResizing) return

      const container = containerRef.current
      if (!container) return
      // Chat body is the positioning ancestor (grandparent: chatBodyRef > footerRef > containerRef)
      const chatBody = container.parentElement?.parentElement
      if (!chatBody) return

      // Derive min height from live DOM: chrome (everything except textarea) + one line of text
      const textarea = container.querySelector('textarea')
      let minHeight = 100
      if (textarea) {
        const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 24
        const chrome = container.offsetHeight - textarea.offsetHeight
        minHeight = chrome + lineHeight
      }

      const handleMouseMove = (e: MouseEvent) => {
        const bodyRect = chatBody.getBoundingClientRect()
        const newHeight = bodyRect.bottom - e.clientY
        const maxAllowed = bodyRect.height

        if (newHeight >= maxAllowed) {
          // Dragged to max — unset constraint
          onMaxHeightChange(undefined)
          return
        }

        onMaxHeightChange(Math.max(minHeight, Math.min(newHeight, maxAllowed)))
      }

      const handleMouseUp = () => {
        setIsResizing(false)
      }

      document.body.style.cursor = 'row-resize'
      document.body.style.userSelect = 'none'
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)

      return () => {
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }, [isResizing, onMaxHeightChange])

    const handleDoubleClick = useCallback(() => {
      onMaxHeightChange(undefined)
    }, [onMaxHeightChange])

    return (
      <div
        ref={containerRef}
        className="flex flex-col min-h-0 bg-background p-chat-shell pt-0"
        style={maxHeight ? { maxHeight } : undefined}
      >
        {/* Drag handle — matches sidebar rail pattern */}
        <button
          aria-label="Resize composer"
          tabIndex={-1}
          onMouseDown={startResizing}
          onDoubleClick={handleDoubleClick}
          className="group relative flex h-3 w-full shrink-0 cursor-row-resize items-center justify-center"
        >
          <div className="h-[2px] w-8 rounded-full bg-transparent transition-colors group-hover:bg-border" />
        </button>

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
