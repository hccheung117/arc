import { useRef, useCallback, useMemo, useState, useEffect } from 'react'
import { getPromptInfo } from '@renderer/lib/prompts'
import { useChatSession } from '@renderer/hooks/use-chat-session'
import { useScrollStore } from '@renderer/hooks/use-scroll-store'
import { useEditingSync } from '@renderer/hooks/use-editing-sync'
import { useSystemPrompt } from '@renderer/hooks/use-system-prompt'
import { useExport } from '@renderer/hooks/use-export'
import { useRefineModel } from '@renderer/hooks/use-refine-model'
import { useComposerMaxHeight } from '@renderer/hooks/use-composer-max-height'
import { useComposerStore } from '@renderer/hooks/use-composer-store'
import { ThreadProvider } from '@renderer/context/thread-context'
import { Header } from './header'
import { MessageList } from './message-list'
import { ChatFooter } from './chat-footer'
import { EmptyState } from './empty-state'
import { PromotePersonaDialog } from './promote-persona-dialog'

// ─────────────────────────────────────────────────────────────────────────────
// Pure derivations
// ─────────────────────────────────────────────────────────────────────────────

function getScrollTargetId(messages) {
  const userMsgs = messages.filter((dm) => dm.message.role === 'user')
  const lastUserMsg = userMsgs.at(-1)
  if (!lastUserMsg) return null

  const userIndex = messages.findIndex((dm) => dm.message.id === lastUserMsg.message.id)
  const nextMsg = messages[userIndex + 1]
  return nextMsg?.message.role === 'assistant' ? nextMsg.message.id : null
}

function deriveEditingState(input, isProtected) {
  const isEditingSystemPrompt = input.mode === 'editing' && input.source.kind === 'system-prompt'

  const editingMessageId =
    input.mode === 'editing' && input.source.kind !== 'system-prompt' ? input.source.id : null

  const editingLabel =
    input.mode !== 'editing'
      ? undefined
      : input.source.kind === 'system-prompt'
        ? 'Editing system prompt'
        : undefined

  const composerMode = isEditingSystemPrompt
    ? { type: 'edit-system-prompt', protected: isProtected }
    : input.mode === 'editing'
      ? { type: 'edit-message' }
      : { type: 'chat' }

  return { isEditingSystemPrompt, editingMessageId, editingLabel, composerMode }
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ChatView: Isolated per-chat component
 *
 * Each ChatView instance is an independent "process" with isolated state.
 * Logic is delegated to useChatSession; this component owns UI wiring.
 */
export function ChatView({ thread, models, findPersona, onThreadUpdate }) {
  const { view, actions } = useChatSession(thread, models, onThreadUpdate)
  const composerRef = useRef(null)

  // Derived state (pure)
  const persona = useMemo(
    () => thread.prompt.type === 'persona' ? findPersona(thread.prompt.ref) : undefined,
    [thread.prompt, findPersona],
  )
  const promptInfo = useMemo(() => getPromptInfo(thread.prompt, persona), [thread.prompt, persona])
  const scrollTargetId = useMemo(() => getScrollTargetId(view.messages), [view.messages])
  const { isEditingSystemPrompt, editingMessageId, editingLabel, composerMode } = deriveEditingState(view.input, promptInfo.isProtected)
  const isEmpty = view.messages.length === 0 && !view.streamingMessage

  // Scroll
  const [viewport, setViewport] = useState(null)
  const { isAtBottom, scrollToBottom } = useScrollStore(viewport, thread.id, scrollTargetId)

  // Composer max height (persisted to IndexedDB)
  const { composerMaxHeight, setComposerMaxHeight } = useComposerMaxHeight()

  // ResizeObserver: sync footer height to CSS variable for message list padding
  const chatBodyRef = useRef(null)
  const footerRef = useRef(null)

  useEffect(() => {
    const footer = footerRef.current
    const chatBody = chatBodyRef.current
    if (!footer || !chatBody) return

    chatBody.style.setProperty('--footer-h', `${footer.offsetHeight}px`)

    const ro = new ResizeObserver(([entry]) => {
      chatBody.style.setProperty('--footer-h', `${entry.contentRect.height}px`)
    })
    ro.observe(footer)
    return () => ro.disconnect()
  }, [])

  // Refine model from layered settings
  const { refineModel } = useRefineModel()

  // Editing coordination
  const { cancel: cancelEdit } = useEditingSync(
    view.input,
    view.messages,
    thread.prompt,
    persona,
    composerRef,
  )

  // System prompt
  const systemPrompt = useSystemPrompt(
    thread,
    promptInfo,
    view.input,
    onThreadUpdate,
    composerRef,
    actions.startEditSystemPrompt,
  )

  // Export
  const handleExport = useExport(thread.id)

  // Simple handlers
  const handleEditMessage = useCallback(
    (_, id, role) => {
      if (role !== 'system') actions.startEditMessage(id, role)
    },
    [actions],
  )

  const handleStop = useCallback(() => {
    if (view.input.mode === 'streaming') view.input.stop()
  }, [view.input])

  const handleSend = isEditingSystemPrompt ? systemPrompt.save : actions.send

  const handleToggleSystemPrompt = useCallback(() => {
    if (isEditingSystemPrompt) {
      cancelEdit()
    } else {
      systemPrompt.startEdit()
    }
  }, [isEditingSystemPrompt, cancelEdit, systemPrompt])

  // Promote persona dialog
  // Store the prompt when dialog opens to avoid subscribing to composer state
  const [promoteDialogState, setPromoteDialogState] = useState({ open: false })
  const { draft } = useComposerStore(thread.id)

  const handlePromote = useCallback(() => {
    setPromoteDialogState({ open: true, prompt: draft })
  }, [draft])

  const handlePromoteDialogClose = useCallback((open) => {
    if (!open) setPromoteDialogState({ open: false })
  }, [])

  return (
    <ThreadProvider threadId={thread.id}>
      <PromotePersonaDialog
        open={promoteDialogState.open}
        onOpenChange={handlePromoteDialogClose}
        systemPrompt={promoteDialogState.open ? promoteDialogState.prompt : ''}
      />
      <div className="flex h-full flex-col overflow-hidden">
        <Header
          selectedModel={view.model}
          onModelSelect={actions.selectModel}
          models={models}
          onExport={handleExport}
          canExport={!isEmpty}
          onEditSystemPrompt={handleToggleSystemPrompt}
          hasSystemPrompt={promptInfo.hasPrompt}
        />

        {/* Chat body: float layout — footer overlays messages, padding keeps content visible */}
        <div ref={chatBodyRef} className="flex-1 min-h-0 relative">
          {/* Background layer: robot icon stays centered regardless of composer growth */}
          {isEmpty && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <EmptyState />
            </div>
          )}

          {/* Message layer: fills entire space, scroll content padded to clear footer */}
          {!isEmpty && (
            <div className="absolute inset-0">
              <MessageList
                messages={view.messages.map((dm) => dm.message)}
                streamingMessage={view.streamingMessage}
                branchPoints={view.branches}
                editingId={editingMessageId}
                onEdit={handleEditMessage}
                onBranchSwitch={actions.selectBranch}
                onViewportMount={setViewport}
                isAtBottom={isAtBottom}
                onScrollToBottom={scrollToBottom}
              />
            </div>
          )}

          {/* Footer layer: floats at bottom over messages */}
          <div ref={footerRef} className="absolute bottom-0 left-0 right-0 z-10 flex flex-col max-h-full">
            <ChatFooter
              ref={composerRef}
              error={view.error}
              maxHeight={composerMaxHeight}
              onMaxHeightChange={setComposerMaxHeight}
              composerProps={{
                threadId: thread.id,
                mode: composerMode,
                onSend: handleSend,
                onStop: handleStop,
                isStreaming: view.input.mode === 'streaming',
                isEditing: view.input.mode === 'editing',
                onCancelEdit: cancelEdit,
                editingLabel,
                allowEmptySubmit: isEditingSystemPrompt,
                onPromote: isEditingSystemPrompt ? handlePromote : undefined,
                refineModel: isEditingSystemPrompt ? refineModel : undefined,
              }}
            />
          </div>
        </div>
      </div>
    </ThreadProvider>
  )
}
