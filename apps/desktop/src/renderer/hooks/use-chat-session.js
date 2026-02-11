import { useState, useCallback, useMemo } from 'react'
import { extractThreadConfig } from '@renderer/lib/threads'
import { useModelSelection } from './use-model-selection'
import { useMessageTree } from './use-message-tree'
import { useStreamingStore } from './use-streaming-store'
import { useEditingStore } from './use-editing-store'
import { createMessage, createBranch, updateMessage, getMessages } from '@renderer/lib/messages'
import { findEditParent, findChildren, composeDisplayMessages } from '@renderer/lib/message-tree'
import { error as logError } from '@renderer/lib/logger'

// ============================================================================
// Private helpers
// ============================================================================

function deriveTitle(content) {
  const firstLine = content.split('\n')[0].trim()
  return firstLine.slice(0, 50)
}

// ─────────────────────────────────────────────────────────────────────────────
// Send flow executors
// ─────────────────────────────────────────────────────────────────────────────

async function executeNewMessage(
  ctx,
  content,
  attachments,
  threadConfig,
) {
  // Thread emerges on first message
  if (threadConfig) {
    const title = deriveTitle(content)
    await window.arc.threads.create({ threadId: ctx.threadId, config: { ...threadConfig, title } })
  }

  const userMessage = await createMessage(
    ctx.threadId,
    'user',
    content,
    ctx.parentId,
    ctx.model.id,
    ctx.model.provider.id,
    attachments,
  )

  ctx.addMessage(userMessage)
  await ctx.startStreaming(userMessage.id)
}

async function executeUserEdit(
  ctx,
  editState,
  content,
  attachments,
  threadConfig,
) {
  const editParentId = findEditParent(ctx.displayMessages, editState.id)
  
  // Thread emerges on first message
  if (threadConfig) {
    const title = deriveTitle(content)
    await window.arc.threads.create({ threadId: ctx.threadId, config: { ...threadConfig, title } })
  }

  await createBranch(
    ctx.threadId,
    editParentId,
    content,
    ctx.model.id,
    ctx.model.provider.id,
    attachments,
  )

  const { messages } = await getMessages(ctx.threadId)

  const childrenAtParent = findChildren(messages, editParentId)
  const newBranchIndex = childrenAtParent.length - 1

  ctx.setMessages(messages)
  ctx.switchBranch(editParentId, newBranchIndex)
  
  // Find the newly created user message (last user message with the edit parent)
  const newUserMessage = messages.filter(m => m.role === 'user' && m.parentId === editParentId).at(-1)
  await ctx.startStreaming(newUserMessage.id)
}

async function executeAssistantEdit(
  ctx,
  editState,
  content,
) {
  const originalMessage = ctx.displayMessages.find((m) => m.id === editState.id)

  if (!originalMessage?.model || !originalMessage?.provider) {
    throw new Error('Cannot edit message: missing model info')
  }

  await updateMessage(
    ctx.threadId,
    editState.id,
    content,
    originalMessage.model,
    originalMessage.provider,
  )

  const { messages } = await getMessages(ctx.threadId)

  ctx.setMessages(messages)
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure derivations
// ─────────────────────────────────────────────────────────────────────────────

function deriveInputMode(
  sending,
  streaming,
  editing,
) {
  if (sending.isSending) {
    return { mode: 'sending' }
  }
  if (streaming.isStreaming) {
    return { mode: 'streaming', stop: streaming.stop }
  }
  if (editing.editingState) {
    const source =
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
  thread,
  models,
  onThreadUpdate,
) {
  const [error, setError] = useState(null)

  const tree = useMessageTree(thread.id)
  const lastMessage = tree.displayMessages[tree.displayMessages.length - 1]
  const { selectedModel, setSelectedModel } = useModelSelection(models, lastMessage)
  const parentId = lastMessage?.id ?? null

  const handleStreamComplete = useCallback(
    (message) => {
      tree.addMessage(message)
      if (thread.status !== 'persisted') {
        onThreadUpdate({ type: 'PATCH', id: thread.id, patch: { status: 'persisted' } })
      }
    },
    [tree.addMessage, thread.status, thread.id, onThreadUpdate],
  )

  const streaming = useStreamingStore(thread.id, parentId)
  const editing = useEditingStore(thread.id)

  const send = useCallback(
    async (content, attachments) => {
      // System prompt edits are handled separately in ChatView
      if (editing.isEditingSystemPrompt) return
      if (!selectedModel) return
      setError(null)

      // Block editing during send to prevent race conditions
      editing.startSending()

      const ctx = {
        threadId: thread.id,
        model: selectedModel,
        parentId,
        displayMessages: tree.displayMessages,
        addMessage: tree.addMessage,
        setMessages: tree.setMessages,
        switchBranch: tree.switchBranch,
        startStreaming: async (userMessageId) => {
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
          const editState = editing.editingState
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
        logError('ui', 'Send failed', err)
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

  const view = useMemo(() => ({
    messages: composeDisplayMessages(tree.displayMessages, streaming.streamingMessage, editingId),
    streamingMessage: streaming.streamingMessage,
    branches: tree.branchPoints,
    model: selectedModel,
    input: deriveInputMode(editing, streaming, editing),
    error,
  }), [tree.displayMessages, streaming.streamingMessage, editingId, tree.branchPoints, selectedModel, streaming, editing, error])

  const actions = useMemo(() => ({
    send,
    startEditMessage: editing.startEditMessage,
    startEditSystemPrompt: editing.startEditSystemPrompt,
    selectModel: setSelectedModel,
    selectBranch: tree.switchBranch,
  }), [send, editing.startEditMessage, editing.startEditSystemPrompt, setSelectedModel, tree.switchBranch])

  return { view, actions }
}
