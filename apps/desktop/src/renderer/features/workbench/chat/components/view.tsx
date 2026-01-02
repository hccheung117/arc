import { useState } from 'react'
import type { Model } from '@arc-types/models'
import type { ChatThread } from '@renderer/features/workbench/chat/thread'
import type { ThreadAction } from '@renderer/features/workbench/chat/use-threads'
import { useChatSession } from '@renderer/features/workbench/chat/hooks/use-chat-session'
import { useAutoScroll } from '@renderer/features/workbench/chat/hooks/use-auto-scroll'
import { Header } from './header'
import { MessageList } from './message-list'
import { Composer } from './composer'
import { EmptyState } from './empty-state'

interface ChatViewProps {
  thread: ChatThread
  models: Model[]
  onThreadUpdate: (action: ThreadAction) => void
}

/**
 * ChatView: Isolated per-chat component
 *
 * Each ChatView instance is an independent "process" with isolated state.
 * All complexity is delegated to useChatSession and its sub-hooks.
 */
export function ChatView({ thread, models, onThreadUpdate }: ChatViewProps) {
  const chat = useChatSession(thread, models, onThreadUpdate)

  // Scroll behavior
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null)
  const { isAtBottom, scrollToBottom } = useAutoScroll(
    viewport,
    chat.streamingMessage?.content,
    thread.id,
  )

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Header
        selectedModel={chat.selectedModel}
        onModelSelect={chat.setSelectedModel}
        models={models}
      />

      {chat.messages.length === 0 && !chat.streamingMessage ? (
        <div className="flex flex-1 min-h-0 items-center justify-center">
          <EmptyState />
        </div>
      ) : (
        <MessageList
          messages={chat.messages}
          streamingMessage={chat.streamingMessage}
          branchPoints={chat.branchPoints}
          editingId={chat.editingState?.messageId ?? null}
          onEdit={chat.handleEditMessage}
          onBranchSwitch={chat.switchBranch}
          onViewportMount={setViewport}
          isAtBottom={isAtBottom}
          isStreaming={chat.isStreaming}
          onScrollToBottom={scrollToBottom}
        />
      )}

      <div className="shrink-0">
        {chat.error && (
          <div className="mx-4 mb-2 rounded-md bg-destructive/10 px-3 py-2 text-label text-destructive select-text cursor-text">
            {chat.error}
          </div>
        )}
        <Composer
          ref={chat.composerRef}
          onSend={chat.send}
          onStop={chat.stop}
          isStreaming={chat.isStreaming}
          isEditing={chat.isEditing}
          onCancelEdit={chat.handleCancelEdit}
        />
      </div>
    </div>
  )
}
