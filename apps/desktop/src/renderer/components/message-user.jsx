import { useState } from 'react'
import { AttachmentGallery } from './message-attachments'
import { useMessageContextMenu } from '@renderer/hooks/use-message-context-menu'
import { MessageFooter } from './message-footer'

/**
 * Renders a user message bubble with attachments and action bar
 */
export function MessageUser({
  id,
  message,
  onEdit,
  isEditing,
  branchInfo,
  onBranchSwitch,
}) {
  const [isHovered, setIsHovered] = useState(false)
  const { handleContextMenu } = useMessageContextMenu({ content: message.content, onEdit })

  const hasAttachments = message.attachments && message.attachments.length > 0

  return (
    <div
      id={id}
      className={`flex justify-end transition-all duration-300 ${isEditing ? 'opacity-40 blur-[1px]' : ''}`}
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
              attachments={message.attachments}
              conversationId={message.conversationId}
            />
          )}
          {message.content && <p className="text-body whitespace-pre-wrap">{message.content}</p>}
        </div>
        <MessageFooter
          content={message.content}
          isHovered={isHovered}
          onEdit={onEdit}
          branchInfo={branchInfo}
          onBranchSwitch={onBranchSwitch}
          align="right"
        />
      </div>
    </div>
  )
}
