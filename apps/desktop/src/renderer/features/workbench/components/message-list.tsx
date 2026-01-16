import type { Message as MessageType, MessageRole } from '@renderer/lib/messages'
import type { BranchInfo } from '@contracts/messages'
import type { StreamingMessage } from '@renderer/features/workbench/domain/stream-state'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { MessageProvider } from '@renderer/features/workbench/context/message-context'
import { Message } from './message'
import { ChevronDown } from 'lucide-react'

interface MessageListProps {
  messages: MessageType[]
  streamingMessage: StreamingMessage | null
  branchPoints: BranchInfo[]
  editingId: string | null
  onEdit: (content: string, messageId: string, role: MessageRole) => void
  onBranchSwitch: (parentId: string | null, index: number) => void
  onViewportMount: (viewport: HTMLDivElement | null) => void
  isAtBottom: boolean
  onScrollToBottom: () => void
}

/**
 * Message list with scroll area and streaming support
 */
export function MessageList({
  messages,
  streamingMessage,
  branchPoints,
  editingId,
  onEdit,
  onBranchSwitch,
  onViewportMount,
  isAtBottom,
  onScrollToBottom,
}: MessageListProps) {
  return (
    <div className="relative flex-1 min-h-0">
      <ScrollArea className="h-full" onViewportMount={onViewportMount}>
        <div className="min-h-full p-chat-shell flex flex-col gap-chat-message-gap">
          {messages.map((message, index) => {
            const parentId = index === 0 ? null : messages[index - 1].id
            const branchInfo = branchPoints.find((bp) => bp.parentId === parentId)
            // Streaming message is the last in array when active (added by composeDisplayMessages)
            const isStreamingMsg = streamingMessage && message.id === streamingMessage.id
            return (
              <MessageProvider key={message.id} messageId={message.id} role={message.role}>
                <Message
                  id={message.id}
                  message={message}
                  isThinking={isStreamingMsg ? streamingMessage.isThinking : undefined}
                  onEdit={(content) => onEdit(content, message.id, message.role)}
                  isEditing={editingId === message.id}
                  branchInfo={branchInfo}
                  onBranchSwitch={(targetIndex) => onBranchSwitch(parentId, targetIndex)}
                />
              </MessageProvider>
            )
          })}
        </div>
      </ScrollArea>

      {!isAtBottom && (
        <button
          onClick={onScrollToBottom}
          className="absolute bottom-chat-shell right-chat-shell flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-opacity hover:bg-primary/90"
          aria-label="Scroll to bottom"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
