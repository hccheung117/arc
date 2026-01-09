import { useState, useCallback } from 'react'
import { Copy, Check, Pencil } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { warn, error } from '@renderer/lib/logger'

interface MessageActionsProps {
  content: string
  isHovered: boolean
  onEdit?: (content: string) => void
}

/**
 * Action buttons for messages (copy, edit).
 * Rendered inline - parent component (MessageFooter) handles alignment.
 */
export function MessageActions({ content, isHovered, onEdit }: MessageActionsProps) {
  const [isCopied, setIsCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }, [content])

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={handleCopy}
        className={`text-muted-foreground hover:text-foreground transition-opacity duration-200 ${isHovered || isCopied ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        {isCopied ? (
          <Check className="w-4 h-4 animate-in zoom-in-50 duration-300" />
        ) : (
          <Copy className="w-4 h-4" />
        )}
      </Button>
      {onEdit && (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onEdit(content)}
          className={`text-muted-foreground hover:text-foreground transition-opacity duration-200 ${isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
          <Pencil className="w-4 h-4" />
        </Button>
      )}
    </>
  )
}

interface UseMessageContextMenuOptions {
  content: string
  onEdit?: (content: string) => void
}

/**
 * Hook for handling message context menu
 */
export function useMessageContextMenu({ content, onEdit }: UseMessageContextMenuOptions) {
  const handleContextMenu = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()

      if (!window.arc.ui?.showMessageContextMenu) {
        warn('ui', 'Context menu API not available')
        return
      }

      try {
        const result = await window.arc.ui.showMessageContextMenu(!!onEdit)

        if (result === 'copy') {
          navigator.clipboard.writeText(content)
        } else if (result === 'edit' && onEdit) {
          onEdit(content)
        }
      } catch (err) {
        error('ui', 'Failed to show context menu', err as Error)
      }
    },
    [content, onEdit],
  )

  return handleContextMenu
}
