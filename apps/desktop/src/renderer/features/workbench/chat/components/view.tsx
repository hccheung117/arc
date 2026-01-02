import { useState, useRef, useEffect, useCallback } from 'react'
import type { MessageRole } from '@arc-types/messages'
import type { Model } from '@arc-types/models'
import type { ChatThread } from '@renderer/features/workbench/chat/domain/thread'
import type { ThreadAction } from '@renderer/features/workbench/chat/hooks/use-threads'
import { useChatSession } from '@renderer/features/workbench/chat/hooks/use-chat-session'
import { useAutoScroll } from '@renderer/features/workbench/chat/hooks/use-auto-scroll'
import { Header } from './header'
import { MessageList } from './message-list'
import { Composer, type ComposerRef } from './composer'
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
 * Logic is delegated to useChatSession; this component owns UI wiring.
 */
export function ChatView({ thread, models, onThreadUpdate }: ChatViewProps) {
  const { view, actions } = useChatSession(thread, models, onThreadUpdate)
  const composerRef = useRef<ComposerRef>(null)

  // Scroll behavior
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null)
  const { isAtBottom, scrollToBottom } = useAutoScroll(
    viewport,
    view.streamingMessage?.content,
    thread.id,
  )

  // Declarative wiring: sync composer with editing state
  const editingMessageId = view.input.mode === 'editing' ? view.input.messageId : null
  useEffect(() => {
    if (editingMessageId) {
      const message = view.messages.find((m) => m.id === editingMessageId)
      if (message) {
        composerRef.current?.setMessage(message.content)
        composerRef.current?.focus()
      }
    }
  }, [editingMessageId, view.messages])

  // Edit message handler - coordinates state with local composer ref
  const handleEditMessage = useCallback(
    (_content: string, messageId: string, role: MessageRole) => {
      actions.startEdit(messageId, role)
    },
    [actions],
  )

  // Cancel edit handler - clears both state and composer
  const handleCancelEdit = useCallback(() => {
    if (view.input.mode === 'editing') {
      view.input.cancel()
    }
    composerRef.current?.setMessage('')
  }, [view.input])

  // Derive stop handler from input state
  const handleStop = useCallback(() => {
    if (view.input.mode === 'streaming') {
      view.input.stop()
    }
  }, [view.input])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Header
        selectedModel={view.model}
        onModelSelect={actions.selectModel}
        models={models}
      />

      {view.messages.length === 0 && !view.streamingMessage ? (
        <div className="flex flex-1 min-h-0 items-center justify-center">
          <EmptyState />
        </div>
      ) : (
        <MessageList
          messages={view.messages}
          streamingMessage={view.streamingMessage}
          branchPoints={view.branches}
          editingId={editingMessageId}
          onEdit={handleEditMessage}
          onBranchSwitch={actions.selectBranch}
          onViewportMount={setViewport}
          isAtBottom={isAtBottom}
          isStreaming={view.input.mode === 'streaming'}
          onScrollToBottom={scrollToBottom}
        />
      )}

      <div className="shrink-0">
        {view.error && (
          <div className="mx-4 mb-2 rounded-md bg-destructive/10 px-3 py-2 text-label text-destructive select-text cursor-text">
            {view.error}
          </div>
        )}
        <Composer
          ref={composerRef}
          onSend={actions.send}
          onStop={handleStop}
          isStreaming={view.input.mode === 'streaming'}
          isEditing={view.input.mode === 'editing'}
          onCancelEdit={handleCancelEdit}
        />
      </div>
    </div>
  )
}
