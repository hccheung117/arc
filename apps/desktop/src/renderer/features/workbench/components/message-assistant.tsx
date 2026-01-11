import { useState } from 'react'
import { BotMessageSquare } from 'lucide-react'
import type { Message } from '@arc-types/messages'
import type { BranchInfo } from '@arc-types/arc-api'
import { Markdown } from '@renderer/components/markdown'
import { ThinkingBlock } from './message-thinking'
import { useMessageContextMenu } from './message-actions'
import { MessageFooter } from './message-footer'

interface MessageAssistantProps {
  id?: string
  threadId: string
  message: Message
  isThinking?: boolean
  onEdit?: (content: string) => void
  isEditing?: boolean
  branchInfo?: BranchInfo
  onBranchSwitch?: (index: number) => void
}

/**
 * Renders an assistant message with reasoning block, markdown content, and action bar
 */
export function MessageAssistant({
  id,
  threadId,
  message,
  isThinking,
  onEdit,
  isEditing,
  branchInfo,
  onBranchSwitch,
}: MessageAssistantProps) {
  const [isHovered, setIsHovered] = useState(false)
  const handleContextMenu = useMessageContextMenu({ content: message.content, onEdit })

  const hasReasoning = message.reasoning && message.reasoning.length > 0
  const isStreaming = message.status === 'streaming'
  const showPulsingCursor = isStreaming && !message.content && !hasReasoning

  return (
    <div
      id={id}
      className={`transition-all duration-300 ${isEditing ? 'opacity-40 blur-[1px]' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex gap-3">
        <div className="shrink-0">
          <BotMessageSquare className="w-8 h-8 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div onContextMenu={handleContextMenu} className="select-text cursor-text">
            {hasReasoning && (
              <ThinkingBlock
                content={message.reasoning!}
                isStreaming={isStreaming && isThinking === true}
              />
            )}

            {/* UX: Show a pulsing cursor during the "thinking" phase before first token */}
            {showPulsingCursor ? (
              <div className="h-[24px] flex items-center">
                <div className="h-4 w-2 bg-foreground/50 animate-pulse rounded-[1px]" />
              </div>
            ) : (
              <Markdown>{message.content}</Markdown>
            )}
          </div>
          <MessageFooter
            content={message.content}
            isHovered={isHovered}
            onEdit={onEdit}
            branchInfo={branchInfo}
            onBranchSwitch={onBranchSwitch}
            align="left"
            threadId={threadId}
            messageId={message.id}
          />
        </div>
      </div>
    </div>
  )
}
