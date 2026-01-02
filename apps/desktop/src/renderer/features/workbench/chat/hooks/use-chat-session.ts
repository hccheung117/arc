import { useState, useCallback, useRef, useEffect } from 'react'
import type { Model } from '@arc-types/models'
import type { Message, MessageRole } from '@arc-types/messages'
import type { AttachmentInput } from '@arc-types/arc-api'
import type { ChatThread } from '@renderer/features/workbench/chat/thread'
import type { ThreadAction } from '@renderer/features/workbench/chat/use-threads'
import { useModelSelection } from './use-model-selection'
import { useMessageTree } from './use-message-tree'
import { useStreaming } from './use-streaming'
import { useEditing } from './use-editing'
import { sendNewMessage, editUserMessage, editAssistantMessage } from '@renderer/features/workbench/chat/domain/send-flows'
import { error as logError } from '@renderer/lib/logger'

export interface ComposerHandle {
  setMessage: (text: string) => void
  focus: () => void
}

interface UseChatSessionReturn {
  // Model
  selectedModel: Model | null
  setSelectedModel: (model: Model | null) => void

  // Messages
  messages: Message[]
  branchPoints: ReturnType<typeof useMessageTree>['branchPoints']
  switchBranch: (parentId: string | null, index: number) => void

  // Streaming
  streamingMessage: ReturnType<typeof useStreaming>['streamingMessage']
  isStreaming: boolean

  // Editing
  editingState: ReturnType<typeof useEditing>['editingState']
  isEditing: boolean
  handleEditMessage: (content: string, messageId: string, role: MessageRole) => void
  handleCancelEdit: () => void

  // Actions
  send: (content: string, attachments?: AttachmentInput[]) => Promise<void>
  stop: () => void

  // Error
  error: string | null

  // Composer ref for parent to wire up
  composerRef: React.RefObject<ComposerHandle>
}

/**
 * Orchestrates all chat session concerns
 *
 * Composes:
 * - Model selection
 * - Message tree with branching
 * - Streaming lifecycle
 * - Editing state
 * - Send/edit flows
 */
export function useChatSession(
  thread: ChatThread,
  models: Model[],
  onThreadUpdate: (action: ThreadAction) => void,
): UseChatSessionReturn {
  const composerRef = useRef<ComposerHandle>(null)
  const [error, setError] = useState<string | null>(null)

  // Compose sub-hooks
  const tree = useMessageTree(thread.id)

  const lastMessage = tree.displayMessages[tree.displayMessages.length - 1]
  const { selectedModel, setSelectedModel } = useModelSelection(models, lastMessage)

  const parentIdForStream = lastMessage?.id ?? null
  const streaming = useStreaming(thread.id, parentIdForStream, (message) => {
    tree.addMessage(message)
    if (thread.status !== 'persisted') {
      onThreadUpdate({ type: 'UPDATE_STATUS', id: thread.id, status: 'persisted' })
    }
  })

  const editing = useEditing()

  // Check for pending stream on mount (from empty state quick-send)
  useEffect(() => {
    const pendingStream = sessionStorage.getItem('arc:activeStream')
    if (pendingStream) {
      try {
        const { threadId } = JSON.parse(pendingStream)
        if (threadId === thread.id) {
          // Resume the stream - the streaming hook will pick up events
          streaming.start(thread.id, selectedModel?.id || '')
          sessionStorage.removeItem('arc:activeStream')
        }
      } catch {
        sessionStorage.removeItem('arc:activeStream')
      }
    }
  }, [thread.id])

  // Send message
  const send = useCallback(
    async (content: string, attachments?: AttachmentInput[]) => {
      if (!selectedModel) return

      setError(null)

      try {
        if (editing.isEditing && editing.editingState) {
          const { messageId, role } = editing.editingState
          const editIndex = tree.displayMessages.findIndex((m) => m.id === messageId)
          const parentId = editIndex > 0 ? tree.displayMessages[editIndex - 1].id : null

          if (role === 'assistant') {
            // Edit assistant message in place
            const originalMessage = tree.displayMessages.find((m) => m.id === messageId)
            const result = await editAssistantMessage({
              threadId: thread.id,
              messageId,
              content,
              role,
              parentId,
              model: selectedModel,
              originalMessage,
            })
            tree.setMessages(result.messages)
          } else {
            // Edit user message: create branch
            const result = await editUserMessage({
              threadId: thread.id,
              messageId,
              content,
              role,
              parentId,
              model: selectedModel,
              attachments,
            })

            tree.setMessages(result.messages)

            if (result.newBranchSelection) {
              tree.switchBranch(result.newBranchSelection.parentId, result.newBranchSelection.index)
            }

            onThreadUpdate({ type: 'UPDATE_STATUS', id: thread.id, status: 'streaming' })
            await streaming.start(thread.id, selectedModel.id)
          }
        } else {
          // New message
          const result = await sendNewMessage({
            threadId: thread.id,
            content,
            parentId: parentIdForStream,
            model: selectedModel,
            attachments,
          })

          if (result.userMessage) {
            tree.addMessage(result.userMessage)
          }

          onThreadUpdate({ type: 'UPDATE_STATUS', id: thread.id, status: 'streaming' })
          await streaming.start(thread.id, selectedModel.id)
        }
      } catch (err) {
        logError('ui', 'Send message failed', err as Error)
        streaming.stop()
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        editing.clearEdit()
      }
    },
    [selectedModel, editing, tree, thread, streaming, onThreadUpdate, parentIdForStream],
  )

  // Edit message handler (wires to composer)
  const handleEditMessage = useCallback(
    (content: string, messageId: string, role: MessageRole) => {
      editing.startEdit(messageId, role)
      composerRef.current?.setMessage(content)
      composerRef.current?.focus()
    },
    [editing],
  )

  // Cancel edit handler
  const handleCancelEdit = useCallback(() => {
    editing.cancelEdit()
    composerRef.current?.setMessage('')
  }, [editing])

  return {
    // Model
    selectedModel,
    setSelectedModel,

    // Messages
    messages: tree.displayMessages,
    branchPoints: tree.branchPoints,
    switchBranch: tree.switchBranch,

    // Streaming
    streamingMessage: streaming.streamingMessage,
    isStreaming: streaming.isStreaming,

    // Editing
    editingState: editing.editingState,
    isEditing: editing.isEditing,
    handleEditMessage,
    handleCancelEdit,

    // Actions
    send,
    stop: streaming.stop,

    // Error
    error,

    // Composer ref (cast to handle null case)
    composerRef: composerRef as React.RefObject<ComposerHandle>,
  }
}
