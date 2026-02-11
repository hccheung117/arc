import { useState, useCallback } from 'react'
import { Copy, Check, Pencil, GitFork } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { duplicateThread } from '@renderer/lib/threads'
import { useThreadId } from '@renderer/context/thread-context'
import { useMessageId } from '@renderer/context/message-context'

const actionButtonClass = (visible) =>
  `text-muted-foreground hover:text-foreground transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`

/**
 * Action buttons for messages (copy, duplicate, edit).
 * Rendered inline - parent component (MessageFooter) handles alignment.
 *
 * Pulls threadId and messageId from context to avoid prop drilling.
 */
export function MessageActions({ content, isHovered, onEdit }) {
  const threadId = useThreadId()
  const messageId = useMessageId()
  const [isCopied, setIsCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }, [content])

  const handleDuplicate = useCallback(() => {
    duplicateThread(threadId, messageId)
  }, [threadId, messageId])

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={handleCopy}
        className={actionButtonClass(isHovered || isCopied)}
        title={isCopied ? 'Copied' : 'Copy message'}
      >
        {isCopied ? (
          <Check className="w-4 h-4 animate-in zoom-in-50 duration-300" />
        ) : (
          <Copy className="w-4 h-4" />
        )}
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={handleDuplicate}
        className={actionButtonClass(isHovered)}
        title="Branch chat"
      >
        <GitFork className="w-4 h-4" />
      </Button>
      {onEdit && (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onEdit(content)}
          className={actionButtonClass(isHovered)}
          title="Edit message"
        >
          <Pencil className="w-4 h-4" />
        </Button>
      )}
    </>
  )
}

