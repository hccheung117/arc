import { useState, useRef, useEffect, useCallback } from 'react'
import type { MessageRole } from '@arc-types/messages'
import type { Model } from '@arc-types/models'
import type { ChatThread, ThreadAction } from '@renderer/lib/threads'
import { useChatSession } from '@renderer/features/workbench/chat/hooks/use-chat-session'
import { useScrollStore } from '@renderer/features/workbench/chat/hooks/use-scroll-store'
import { formatMessagesToMarkdown, generateExportFilename } from '@renderer/features/workbench/chat/domain/export'
import { Header } from './header'
import { MessageList } from './message-list'
import { ChatFooter } from './chat-footer'
import type { ComposerRef } from './composer'
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

  // Scroll behavior with persistence
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null)
  const { isAtBottom, scrollToBottom } = useScrollStore(
    viewport,
    view.streamingMessage?.content,
    thread.id,
  )

  // Declarative wiring: sync composer with editing state
  const editingMessageId = view.input.mode === 'editing' ? view.input.messageId : null
  useEffect(() => {
    if (editingMessageId) {
      const dm = view.messages.find((dm) => dm.message.id === editingMessageId)
      if (dm) {
        composerRef.current?.setMessage(dm.message.content)
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

  // Export handler - shows save dialog first, then generates markdown only if user confirms
  const handleExport = useCallback(async () => {
    const messages = view.messages.map((dm) => dm.message)
    if (messages.length === 0) return

    const filePath = await window.arc.files.showSaveDialog({
      defaultPath: generateExportFilename(),
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    })

    if (filePath) {
      const markdown = formatMessagesToMarkdown(messages)
      await window.arc.files.writeFile(filePath, markdown)
    }
  }, [view.messages])

  const isEmpty = view.messages.length === 0 && !view.streamingMessage

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Header
        selectedModel={view.model}
        onModelSelect={actions.selectModel}
        models={models}
        onExport={handleExport}
        canExport={!isEmpty}
      />

      {/* Chat body: layered architecture for stable robot positioning */}
      <div className="flex-1 min-h-0 relative">
        {/* Background layer: robot icon stays centered regardless of composer growth */}
        {isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <EmptyState />
          </div>
        )}

        {/* Content layer: flex column pushes footer to bottom */}
        <div className="absolute inset-0 flex flex-col">
          {isEmpty ? (
            <div className="flex-1 min-h-0" />
          ) : (
            <MessageList
              messages={view.messages.map((dm) => dm.message)}
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

          <ChatFooter
            ref={composerRef}
            error={view.error}
            composerProps={{
              threadId: thread.id,
              onSend: actions.send,
              onStop: handleStop,
              isStreaming: view.input.mode === 'streaming',
              isEditing: view.input.mode === 'editing',
              onCancelEdit: handleCancelEdit,
            }}
          />
        </div>
      </div>
    </div>
  )
}
