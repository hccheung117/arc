import { useState, useCallback } from "react"
import { warn, error } from "@renderer/lib/logger"
import { BotMessageSquare, Copy, Check, Pencil } from "lucide-react"
import { Button } from "@renderer/components/ui/button"
import { Markdown } from "@renderer/components/markdown"
import { ThinkingBlock } from "./message-thinking"
import { BranchIndicator } from "./message-branch"
import type { Message as MessageType, MessageAttachment } from '@arc-types/messages'
import type { BranchInfo } from '@arc-types/arc-api'

interface MessageProps {
  message: MessageType
  isThinking?: boolean
  onEdit?: (content: string) => void
  isEditing?: boolean
  branchInfo?: BranchInfo
  onBranchSwitch?: (index: number) => void
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
      const absolutePath = await window.arc.utils.getThreadAttachmentPath(
        conversationId,
        attachment.path
      )
      await window.arc.utils.openFile(absolutePath)
    } catch (err) {
      error('ui', 'Failed to open attachment', err as Error)
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

export function Message({ message, isThinking, onEdit, isEditing, branchInfo, onBranchSwitch }: MessageProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const hasAttachments = message.attachments && message.attachments.length > 0
  const hasReasoning = message.reasoning && message.reasoning.length > 0

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  const handleContextMenu = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // Safety check for API availability (in case of version mismatch/hot-reload lag)
    if (!window.arc.ui?.showMessageContextMenu) {
      warn('ui', 'Context menu API not available')
      return
    }

    try {
      const result = await window.arc.ui.showMessageContextMenu(!!onEdit)

      if (result === 'copy') {
        navigator.clipboard.writeText(message.content)
      } else if (result === 'edit' && onEdit) {
        onEdit(message.content)
      }
    } catch (err) {
      error('ui', 'Failed to show context menu', err as Error)
    }
  }, [message.content, onEdit])

  if (message.role === "user") {
    return (
      <div className={`flex justify-end mb-6 transition-all duration-300 ${isEditing ? 'opacity-40 blur-[1px]' : ''}`}>
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
          <div 
            className="bg-muted rounded-2xl px-4 py-3 select-text cursor-text"
            onContextMenu={handleContextMenu}
          >
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
          <div className="h-8 flex items-center gap-1">
            {branchInfo && branchInfo.branches.length > 1 && onBranchSwitch && (
              <BranchIndicator branchInfo={branchInfo} onSwitch={onBranchSwitch} />
            )}
            <div className="flex-1" />
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
                onClick={() => onEdit(message.content)}
                className={`text-muted-foreground hover:text-foreground transition-opacity duration-200 ${isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
              >
                <Pencil className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`mb-6 transition-all duration-300 ${isEditing ? 'opacity-40 blur-[1px]' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex gap-3">
        <div className="shrink-0">
          <BotMessageSquare className="w-8 h-8 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div onContextMenu={handleContextMenu} className="select-text cursor-text">
            {/* Reasoning/thinking block for AI models that support it */}
            {hasReasoning && (
              <ThinkingBlock
                content={message.reasoning!}
                isStreaming={message.status === 'streaming' && isThinking === true}
              />
            )}

            {/* UX: Show a pulsing cursor during the "thinking" phase before first token */}
            {message.status === 'streaming' && !message.content && !hasReasoning ? (
              <div className="h-[24px] flex items-center">
                <div className="h-4 w-2 bg-foreground/50 animate-pulse rounded-[1px]" />
              </div>
            ) : (
              <Markdown>{message.content}</Markdown>
            )}
          </div>
          <div className="h-8 flex items-center gap-1">
            {branchInfo && branchInfo.branches.length > 1 && onBranchSwitch && (
              <BranchIndicator branchInfo={branchInfo} onSwitch={onBranchSwitch} />
            )}
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
                onClick={() => onEdit(message.content)}
                className={`text-muted-foreground hover:text-foreground transition-opacity duration-200 ${isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
              >
                <Pencil className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
