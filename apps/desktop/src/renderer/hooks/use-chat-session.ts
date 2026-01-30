import { useState, useCallback, useMemo } from 'react'
import type { Message } from '@renderer/lib/messages'
import type { BranchInfo, AttachmentInput } from '@main/modules/messages/business'
import type { ThreadConfig } from '@main/modules/threads/json-file'
import type { Model } from '@main/modules/profiles/business'
import { type ChatThread, type ThreadAction, extractThreadConfig } from '@renderer/lib/threads'
import type { DisplayMessage, InputMode, EditingState, EditSource } from '@renderer/lib/types'
import { useModelSelection } from './use-model-selection'
import { useMessageTree } from './use-message-tree'
import { useStreamingStore } from './use-streaming-store'
import { useEditingStore } from './use-editing-store'
import {
  sendNewMessage,
  editUserMessage,
  editAssistantMessage,
} from '@renderer/lib/send-flows'
import { findEditParent, composeDisplayMessages } from '@renderer/lib/message-tree'
import { getStreamingMessage } from '@renderer/lib/stream-state'
import { error as logError } from '@renderer/lib/logger'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Streaming message display type with isThinking flag */
type StreamingMessageDisplay = ReturnType<typeof getStreamingMessage>

interface ChatSessionView {
  messages: DisplayMessage[]
  streamingMessage: StreamingMessageDisplay
  branches: BranchInfo[]
  model: Model | null
  input: InputMode
  error: string | null
}

interface ChatSessionActions {
  send: (content: string, attachments?: AttachmentInput[]) => Promise<void>
  startEditMessage: (messageId: string, role: 'user' | 'assistant') => void
  startEditSystemPrompt: () => void
  selectModel: (model: Model | null) => void
  selectBranch: (parentId: string | null, index: number) => void
}

interface ChatSession {
  view: ChatSessionView
  actions: ChatSessionActions
}

/** Context passed to send flow executors */
interface SendFlowContext {
  threadId: string
  model: Model
  parentId: string | null
  displayMessages: Message[]
  addMessage: (m: Message) => void
  setMessages: (m: Message[]) => void
  switchBranch: (parentId: string | null, index: number) => void
  startStreaming: (userMessageId: string) => Promise<void>
}

// ─────────────────────────────────────────────────────────────────────────────
// Send flow executors
// ─────────────────────────────────────────────────────────────────────────────

async function executeNewMessage(
  ctx: SendFlowContext,
  content: string,
  attachments?: AttachmentInput[],
  threadConfig?: ThreadConfig,
): Promise<void> {
  const result = await sendNewMessage({
    threadId: ctx.threadId,
    content,
    parentId: ctx.parentId,
    model: ctx.model,
    attachments,
    threadConfig,
  })
  ctx.addMessage(result.userMessage!)
  await ctx.startStreaming(result.userMessage!.id)
}

/** Message editing state (excludes system-prompt) */
type MessageEditingState = Extract<EditingState, { kind: 'user-message' | 'assistant-message' }>

async function executeUserEdit(
  ctx: SendFlowContext,
  editState: MessageEditingState,
  content: string,
  attachments?: AttachmentInput[],
  threadConfig?: ThreadConfig,
): Promise<void> {
  const editParentId = findEditParent(ctx.displayMessages, editState.id)
  const result = await editUserMessage({
    threadId: ctx.threadId,
    messageId: editState.id,
    content,
    role: editState.role,
    parentId: editParentId,
    model: ctx.model,
    attachments,
    threadConfig,
  })
  ctx.setMessages(result.messages)
  if (result.newBranchSelection) {
    ctx.switchBranch(result.newBranchSelection.parentId, result.newBranchSelection.index)
  }
  // Find the newly created user message (last user message with the edit parent)
  const newUserMessage = result.messages.filter(m => m.role === 'user' && m.parentId === editParentId).at(-1)
  await ctx.startStreaming(newUserMessage!.id)
}

async function executeAssistantEdit(
  ctx: SendFlowContext,
  editState: MessageEditingState,
  content: string,
): Promise<void> {
  const originalMessage = ctx.displayMessages.find((m) => m.id === editState.id)
  const editParentId = findEditParent(ctx.displayMessages, editState.id)
  const result = await editAssistantMessage({
    threadId: ctx.threadId,
    messageId: editState.id,
    content,
    role: editState.role,
    parentId: editParentId,
    model: ctx.model,
    originalMessage,
  })
  ctx.setMessages(result.messages)
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure derivations
// ─────────────────────────────────────────────────────────────────────────────

function deriveInputMode(
  sending: { isSending: boolean },
  streaming: { isStreaming: boolean; stop: () => void },
  editing: { editingState: EditingState | null; cancelEdit: () => void },
): InputMode {
  if (sending.isSending) {
    return { mode: 'sending' }
  }
  if (streaming.isStreaming) {
    return { mode: 'streaming', stop: streaming.stop }
  }
  if (editing.editingState) {
    const source: EditSource =
      editing.editingState.kind === 'system-prompt'
        ? { kind: 'system-prompt' }
        : editing.editingState.kind === 'user-message'
          ? { kind: 'user-message', id: editing.editingState.id }
          : { kind: 'assistant-message', id: editing.editingState.id }

    return {
      mode: 'editing',
      source,
      cancel: editing.cancelEdit,
    }
  }
  return { mode: 'ready' }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useChatSession(
  thread: ChatThread,
  models: Model[],
  onThreadUpdate: (action: ThreadAction) => void,
): ChatSession {
  const [error, setError] = useState<string | null>(null)

  const tree = useMessageTree(thread.id)
  const lastMessage = tree.displayMessages[tree.displayMessages.length - 1]
  const { selectedModel, setSelectedModel } = useModelSelection(models, lastMessage)
  const parentId = lastMessage?.id ?? null

  const handleStreamComplete = useCallback(
    (message: Message) => {
      tree.addMessage(message)
      if (thread.status !== 'persisted') {
        onThreadUpdate({ type: 'PATCH', id: thread.id, patch: { status: 'persisted' } })
      }
    },
    [tree, thread.status, thread.id, onThreadUpdate],
  )

  const streaming = useStreamingStore(thread.id, parentId)
  const editing = useEditingStore(thread.id)

  const send = useCallback(
    async (content: string, attachments?: AttachmentInput[]) => {
      // System prompt edits are handled separately in ChatView
      if (editing.isEditingSystemPrompt) return
      if (!selectedModel) return
      setError(null)

      // Block editing during send to prevent race conditions
      editing.startSending()

      const ctx: SendFlowContext = {
        threadId: thread.id,
        model: selectedModel,
        parentId,
        displayMessages: tree.displayMessages,
        addMessage: tree.addMessage,
        setMessages: tree.setMessages,
        switchBranch: tree.switchBranch,
        startStreaming: async (userMessageId: string) => {
          onThreadUpdate({ type: 'PATCH', id: thread.id, patch: { status: 'streaming' } })
          await streaming.start(selectedModel.provider.id, selectedModel.id, thread.prompt, handleStreamComplete, userMessageId)
        },
      }

      // Extract config for local threads - bundled with first message during handoff
      const threadConfig = thread.owner === 'local' ? extractThreadConfig(thread) : undefined

      try {
        if (!editing.isEditingMessage) {
          await executeNewMessage(ctx, content, attachments, threadConfig)
        } else {
          const editState = editing.editingState as MessageEditingState
          if (editState.role === 'assistant') {
            await executeAssistantEdit(ctx, editState, content)
          } else {
            await executeUserEdit(ctx, editState, content, attachments, threadConfig)
          }
        }
        // Transfer ownership to DB after successful send
        if (thread.owner === 'local') {
          onThreadUpdate({ type: 'PATCH', id: thread.id, patch: { owner: 'db' } })
        }
      } catch (err) {
        logError('ui', 'Send failed', err as Error)
        streaming.stop()
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        editing.stopSending()
        editing.clearEdit()
      }
    },
    [selectedModel, editing, tree, thread, streaming, onThreadUpdate, parentId, handleStreamComplete],
  )

  // Extract message ID for highlighting (only for message edits)
  const editingId =
    editing.editingState && editing.editingState.kind !== 'system-prompt'
      ? editing.editingState.id
      : null

  const view: ChatSessionView = useMemo(() => ({
    messages: composeDisplayMessages(tree.displayMessages, streaming.streamingMessage, editingId),
    streamingMessage: streaming.streamingMessage,
    branches: tree.branchPoints,
    model: selectedModel,
    input: deriveInputMode(editing, streaming, editing),
    error,
  }), [tree.displayMessages, streaming.streamingMessage, editingId, tree.branchPoints, selectedModel, streaming, editing, error])

  const actions: ChatSessionActions = useMemo(() => ({
    send,
    startEditMessage: editing.startEditMessage,
    startEditSystemPrompt: editing.startEditSystemPrompt,
    selectModel: setSelectedModel,
    selectBranch: tree.switchBranch,
  }), [send, editing.startEditMessage, editing.startEditSystemPrompt, setSelectedModel, tree.switchBranch])

  return { view, actions }
}
