import { useState, useCallback } from "react"
import { BotMessageSquare, Copy, Check } from "lucide-react"
import { Button } from "@renderer/components/ui/button"
import { Markdown } from "@renderer/components/markdown"
import type { Message as MessageType, MessageAttachment } from '@arc-types/messages'

interface MessageProps {
  message: MessageType
}

/** Renders a clickable image attachment */
function AttachmentImage({
  attachment,
  conversationId
}: {
  attachment: MessageAttachment
  conversationId: string
}) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  const handleClick = useCallback(async () => {
    try {
      const absolutePath = await window.arc.utils.getAttachmentPath(
        conversationId,
        attachment.path
      )
      await window.arc.utils.openFile(absolutePath)
    } catch (err) {
      console.error('Failed to open attachment:', err)
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
      {isLoading && (
        <div className="h-32 w-32 bg-muted animate-pulse" />
      )}
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

/** Renders a gallery of attachments */
function AttachmentGallery({
  attachments,
  conversationId
}: {
  attachments: MessageAttachment[]
  conversationId: string
}) {
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

export function Message({ message }: MessageProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const hasAttachments = message.attachments && message.attachments.length > 0

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  if (message.role === "user") {
    return (
      <div className="flex justify-end mb-6">
        <div
          className="max-w-[70%]"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/**
           * Typography: User message bubbles use text-body (16px/24px) for comfortable
           * reading density. This matches the prose content size used for AI responses,
           * creating visual consistency across the conversation.
           *
           * @see tailwind.config.js - Typography scale definition
           */}
          <div className="bg-muted rounded-2xl px-4 py-3">
            {/* Attachments rendered above text */}
            {hasAttachments && (
              <AttachmentGallery
                attachments={message.attachments!}
                conversationId={message.conversationId}
              />
            )}
            {message.content && (
              <p className="text-body whitespace-pre-wrap">{message.content}</p>
            )}
          </div>
          <div className="h-8 flex items-center justify-end">
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
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="mb-6"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex gap-3">
        <div className="shrink-0 mt-1">
          <BotMessageSquare className="w-5 h-5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          {/* UX: Show a pulsing cursor during the "thinking" phase before first token */}
          {message.status === 'streaming' && !message.content ? (
            <div className="h-[24px] flex items-center">
              <div className="h-4 w-2 bg-foreground/50 animate-pulse rounded-[1px]" />
            </div>
          ) : (
            <Markdown>{message.content}</Markdown>
          )}
          <div className="h-8 flex items-center justify-start">
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
          </div>
        </div>
      </div>
    </div>
  )
}
