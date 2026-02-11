import { useState, useCallback } from 'react'
import { error } from '@renderer/lib/logger'
import { openAttachment } from '@renderer/lib/attachments'

/**
 * Renders a clickable image attachment that opens in the system viewer
 */
export function AttachmentImage({ attachment, conversationId }) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  const handleClick = useCallback(async () => {
    try {
      await openAttachment(conversationId, attachment.path)
    } catch (err) {
      error('ui', 'Failed to open attachment', err)
    }
  }, [conversationId, attachment.path])

  if (hasError) {
    return (
      <div className="h-32 w-32 rounded-md border border-border bg-muted flex items-center justify-center">
        <span className="text-meta text-muted-foreground">Failed to load</span>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="block rounded-md overflow-hidden border border-border hover:border-primary transition-colors cursor-pointer"
    >
      {isLoading && <div className="h-32 w-32 bg-muted animate-pulse" />}
      <img
        src={attachment.url}
        alt="Attachment"
        className={`max-h-48 max-w-xs object-contain ${isLoading ? 'hidden' : ''}`}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false)
          setHasError(true)
        }}
      />
    </button>
  )
}

/**
 * Renders a gallery of message attachments
 */
export function AttachmentGallery({ attachments, conversationId }) {
  return (
    <div className="flex flex-wrap gap-2 mb-2">
      {attachments.map((attachment, index) => (
        <AttachmentImage
          key={`${attachment.path}-${index}`}
          attachment={attachment}
          conversationId={conversationId}
        />
      ))}
    </div>
  )
}
