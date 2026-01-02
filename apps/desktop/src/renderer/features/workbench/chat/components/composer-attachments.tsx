import { X } from 'lucide-react'
import type { ComposerAttachment } from '@renderer/features/workbench/chat/hooks/use-attachments'

interface AttachmentThumbnailProps {
  attachment: ComposerAttachment
  onRemove: (id: string) => void
}

function AttachmentThumbnail({ attachment, onRemove }: AttachmentThumbnailProps) {
  return (
    <div className="relative group">
      <img
        src={attachment.preview}
        alt="Attachment preview"
        className="h-16 w-16 object-cover rounded-md border border-border"
      />
      <button
        type="button"
        onClick={() => onRemove(attachment.id)}
        className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}

interface AttachmentGridProps {
  attachments: ComposerAttachment[]
  onRemove: (id: string) => void
}

/**
 * Grid of attachment thumbnails with remove buttons
 */
export function AttachmentGrid({ attachments, onRemove }: AttachmentGridProps) {
  if (attachments.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 pb-2">
      {attachments.map((attachment) => (
        <AttachmentThumbnail
          key={attachment.id}
          attachment={attachment}
          onRemove={onRemove}
        />
      ))}
    </div>
  )
}
