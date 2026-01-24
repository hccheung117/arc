import { useRef, useCallback, useMemo, useState, useEffect } from 'react'
import type { MessageRole } from '@renderer/lib/messages'
import type { Model } from '@main/modules/profiles/business'
import type { Persona } from '@main/modules/personas/business'
import type { ChatThread, ThreadAction } from '@renderer/lib/threads'
import type { DisplayMessage, InputMode } from '@renderer/lib/types'
import { getPromptInfo } from '@renderer/lib/prompts'
import { useChatUIStore } from '@renderer/stores/chat-ui-store'
import { useChatSession } from '@renderer/hooks/use-chat-session'
import { useScrollStore } from '@renderer/hooks/use-scroll-store'
import { useEditingSync } from '@renderer/hooks/use-editing-sync'
import { useSystemPrompt } from '@renderer/hooks/use-system-prompt'
import { useExport } from '@renderer/hooks/use-export'
import { ThreadProvider } from '@renderer/context/thread-context'
import { Header } from './header'
import { MessageList } from './message-list'
import { ChatFooter } from './chat-footer'
import type { ComposerRef, ComposerMode } from './composer'
import { EmptyState } from './empty-state'
import { PromotePersonaDialog } from './promote-persona-dialog'

// ─────────────────────────────────────────────────────────────────────────────
// Pure derivations
// ─────────────────────────────────────────────────────────────────────────────

function getScrollTargetId(messages: DisplayMessage[]) {
  const userMsgs = messages.filter((dm) => dm.message.role === 'user')
  const lastUserMsg = userMsgs.at(-1)
  if (!lastUserMsg) return null

  const userIndex = messages.findIndex((dm) => dm.message.id === lastUserMsg.message.id)
  const nextMsg = messages[userIndex + 1]
  return nextMsg?.message.role === 'assistant' ? nextMsg.message.id : null
}

function deriveEditingState(input: InputMode, isProtected: boolean) {
  const isEditingSystemPrompt = input.mode === 'editing' && input.source.kind === 'system-prompt'

  const editingMessageId =
    input.mode === 'editing' && input.source.kind !== 'system-prompt' ? input.source.id : null

  const editingLabel =
    input.mode !== 'editing'
      ? undefined
      : input.source.kind === 'system-prompt'
        ? 'Editing system prompt'
        : undefined

  const composerMode: ComposerMode = isEditingSystemPrompt
    ? { type: 'edit-system-prompt', protected: isProtected }
    : input.mode === 'editing'
      ? { type: 'edit-message' }
      : { type: 'chat' }

  return { isEditingSystemPrompt, editingMessageId, editingLabel, composerMode }
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface ChatViewProps {
  thread: ChatThread
  models: Model[]
  findPersona: (personaId: string) => Persona | undefined
  onThreadUpdate: (action: ThreadAction) => void
}

/**
 * ChatView: Isolated per-chat component
 *
 * Each ChatView instance is an independent "process" with isolated state.
 * Logic is delegated to useChatSession; this component owns UI wiring.
 */
export function ChatView({ thread, models, findPersona, onThreadUpdate }: ChatViewProps) {
  const { view, actions } = useChatSession(thread, models, onThreadUpdate)
  const composerRef = useRef<ComposerRef>(null)

  // Derived state (pure)
  const persona = useMemo(
    () => thread.promptSource.type === 'persona' ? findPersona(thread.promptSource.personaId) : undefined,
    [thread.promptSource, findPersona],
  )
  const promptInfo = useMemo(() => getPromptInfo(thread.promptSource, persona), [thread.promptSource, persona])
  const scrollTargetId = useMemo(() => getScrollTargetId(view.messages), [view.messages])
  const { isEditingSystemPrompt, editingMessageId, editingLabel, composerMode } = deriveEditingState(view.input, promptInfo.isProtected)
  const isEmpty = view.messages.length === 0 && !view.streamingMessage

  // Scroll
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null)
  const { isAtBottom, scrollToBottom } = useScrollStore(viewport, thread.id, scrollTargetId)

  // Refine model from active profile
  const [refineModel, setRefineModel] = useState<string | undefined>(undefined)
  useEffect(() => {
    const fetchRefineModel = () => {
      window.arc.profiles.getActiveDetails().then((profile) => {
        setRefineModel(profile?.modelAssignments?.refine?.model)
      })
    }

    fetchRefineModel()

    // Re-fetch when profile changes
    const unsub1 = window.arc.profiles.onInstalled(fetchRefineModel)
    const unsub2 = window.arc.profiles.onActivated(fetchRefineModel)
    return () => { unsub1(); unsub2() }
  }, [])

  // Editing coordination
  const { cancel: cancelEdit } = useEditingSync(
    view.input,
    view.messages,
    thread.promptSource,
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
  const handleExport = useExport(view.messages)

  // Simple handlers
  const handleEditMessage = useCallback(
    (_: string, id: string, role: MessageRole) => {
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
  const [promoteDialogState, setPromoteDialogState] = useState<{ open: false } | { open: true; prompt: string }>({ open: false })

  const handlePromote = useCallback(() => {
    const draft = useChatUIStore.getState().getThreadState(thread.id).composer.draft
    setPromoteDialogState({ open: true, prompt: draft })
  }, [thread.id])

  const handlePromoteDialogClose = useCallback((open: boolean) => {
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
                onScrollToBottom={scrollToBottom}
              />
            )}

            <ChatFooter
              ref={composerRef}
              error={view.error}
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
