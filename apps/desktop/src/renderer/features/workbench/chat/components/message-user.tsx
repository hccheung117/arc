import { useState } from 'react'
import type { Message, MessageAttachment } from '@arc-types/messages'
import type { BranchInfo } from '@arc-types/arc-api'
import { AttachmentGallery } from './message-attachments'
import { MessageActions, useMessageContextMenu } from './message-actions'
import { BranchIndicator } from './message-branch'

interface MessageUserProps {
  message: Message
  onEdit?: (content: string) => void
  isEditing?: boolean
  branchInfo?: BranchInfo
  onBranchSwitch?: (index: number) => void
}

/**
 * Renders a user message bubble with attachments and action bar
 */
export function MessageUser({
  message,
  onEdit,
  isEditing,
  branchInfo,
  onBranchSwitch,
}: MessageUserProps) {
  const [isHovered, setIsHovered] = useState(false)
  const handleContextMenu = useMessageContextMenu({ content: message.content, onEdit })

  const hasAttachments = message.attachments && message.attachments.length > 0

  return (
    <div
      className={`flex justify-end mb-6 transition-all duration-300 ${isEditing ? 'opacity-40 blur-[1px]' : ''}`}
    >
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
          {hasAttachments && (
            <AttachmentGallery
              attachments={message.attachments as MessageAttachment[]}
              conversationId={message.conversationId}
            />
          )}
          {message.content && <p className="text-body whitespace-pre-wrap">{message.content}</p>}
        </div>
        <div className="h-8 flex items-center gap-1">
          {branchInfo && branchInfo.branches.length > 1 && onBranchSwitch && (
            <BranchIndicator branchInfo={branchInfo} onSwitch={onBranchSwitch} />
          )}
          <MessageActions
            content={message.content}
            isHovered={isHovered}
            onEdit={onEdit}
            align="right"
          />
        </div>
      </div>
    </div>
  )
}
