import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { error } from '@renderer/lib/logger'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Composer, type ComposerRef } from './composer'
import { Message } from './message'
import { ModelSelector } from './model-selector'
import { EmptyState } from './empty-state'
import type { Model } from '@arc-types/models'
import type { Message as MessageType, MessageRole } from '@arc-types/messages'
import type { AttachmentInput, BranchInfo } from '@arc-types/arc-api'
import { getMessages, createMessage, createBranch, updateMessage, startAIChat, stopAIChat, onAIEvent } from '@renderer/lib/messages'
import { getBranchSelections, setBranchSelection } from '@renderer/lib/ui-state-db'
import type { ChatThread } from './chat-thread'
import type { ThreadAction } from './use-chat-threads'
import { useAutoScroll } from './use-auto-scroll'
import { ChevronDown } from 'lucide-react'

interface ChatViewProps {
  thread: ChatThread
  models: Model[]
  onThreadUpdate: (action: ThreadAction) => void
}

interface StreamingMessage {
  id: string
  role: 'assistant'
  content: string
  reasoning: string
  status: 'streaming'
  isThinking: boolean
}

interface EditingState {
  messageId: string
  role: MessageRole
}

/**
 * ChatView: Isolated per-chat component
 *
 * Each ChatView instance manages its own:
 * - Model selection (initialized from last message's model)
 * - Streaming state (streamingMessage, activeStreamId)
 * - Messages and branch selections
 * - Error and editing state
 *
 * This isolation ensures chats are independent "processes" that don't
 * leak state when switching between them.
 */
export function ChatView({ thread, models, onThreadUpdate }: ChatViewProps) {
  // Per-chat isolated state
  const [selectedModel, setSelectedModel] = useState<Model | null>(null)
  const [streamingMessage, setStreamingMessage] = useState<StreamingMessage | null>(null)
  const [activeStreamId, setActiveStreamId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [editingState, setEditingState] = useState<EditingState | null>(null)
  const composerRef = useRef<ComposerRef>(null)

  // All messages for this thread (full tree)
  const [allMessages, setAllMessages] = useState<MessageType[]>([])
  // Branch selections: parentId (or 'root') -> selected branch index
  const [branchSelections, setBranchSelections] = useState<Record<string, number>>({})

  // Scroll viewport for auto-scroll behavior
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null)
  const { isAtBottom, scrollToBottom } = useAutoScroll(viewport, streamingMessage?.content, thread.id)

  // Compute display messages and branch points from all messages + selections
  const { displayMessages, branchPoints } = useMemo(() => {
    if (allMessages.length === 0) {
      return { displayMessages: [] as MessageType[], branchPoints: [] as BranchInfo[] }
    }

    // Build children map: parentId -> child messages (sorted by createdAt)
    const childrenMap = new Map<string | null, MessageType[]>()
    for (const msg of allMessages) {
      const parentId = msg.parentId ?? null
      if (!childrenMap.has(parentId)) {
        childrenMap.set(parentId, [])
      }
      childrenMap.get(parentId)!.push(msg)
    }

    // Sort children by createdAt
    for (const children of childrenMap.values()) {
      children.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    }

    // Walk the tree following selections
    const path: MessageType[] = []
    const points: BranchInfo[] = []
    let currentParentId: string | null = null

    while (true) {
      const children = childrenMap.get(currentParentId)
      if (!children || children.length === 0) break

      // Check if this is a branch point
      if (children.length > 1) {
        const selectionKey = currentParentId ?? 'root'
        // Default to latest branch (last index) when no saved selection
        const selectedIndex = branchSelections[selectionKey] ?? (children.length - 1)
        const clampedIndex = Math.min(selectedIndex, children.length - 1)

        points.push({
          parentId: currentParentId,
          branches: children.map((c) => c.id),
          currentIndex: clampedIndex,
        })

        path.push(children[clampedIndex])
        currentParentId = children[clampedIndex].id
      } else {
        path.push(children[0])
        currentParentId = children[0].id
      }
    }

    return { displayMessages: path, branchPoints: points }
  }, [allMessages, branchSelections])

  const messages = displayMessages

  // Load messages, branch selections, and check for pending stream on mount
  useEffect(() => {
    // Load branch selections from IndexedDB
    getBranchSelections(thread.id).then(setBranchSelections)

    // Check for pending stream started from empty state
    const pendingStream = sessionStorage.getItem('arc:activeStream')
    if (pendingStream) {
      try {
        const { threadId, streamId } = JSON.parse(pendingStream)
        if (threadId === thread.id) {
          // This thread has an active stream - pick it up
          setActiveStreamId(streamId)
          setStreamingMessage({
            id: `streaming-${streamId}`,
            role: 'assistant',
            content: '',
            reasoning: '',
            status: 'streaming',
            isThinking: false,
          })
          sessionStorage.removeItem('arc:activeStream')
        }
      } catch {
        sessionStorage.removeItem('arc:activeStream')
      }
    }

    // Fetch messages and initialize model from last message
    getMessages(thread.id).then(({ messages: fetchedMessages }) => {
      setAllMessages(fetchedMessages)

      // Initialize model from last message, fallback to localStorage default
      const lastMessage = fetchedMessages[fetchedMessages.length - 1]
      if (lastMessage?.modelId) {
        const model = models.find((m) => m.id === lastMessage.modelId)
        if (model) {
          setSelectedModel(model)
          return
        }
      }

      // Fallback: use localStorage default or first model
      const savedId = localStorage.getItem('arc:selectedModelId')
      const savedModel = savedId ? models.find((m) => m.id === savedId) : null
      setSelectedModel(savedModel || models[0] || null)
    })
  }, [thread.id, models])

  // Set up streaming event listeners for THIS chat's stream
  useEffect(() => {
    const cleanup = onAIEvent((event) => {
      // Only process events for THIS chat's active stream
      if (event.streamId !== activeStreamId) return

      if (event.type === 'reasoning') {
        setStreamingMessage((prev) => ({
          id: prev?.id || `streaming-${Date.now()}`,
          role: 'assistant',
          content: prev?.content || '',
          reasoning: (prev?.reasoning || '') + event.chunk,
          status: 'streaming',
          isThinking: true,
        }))
      } else if (event.type === 'delta') {
        setStreamingMessage((prev) => ({
          id: prev?.id || `streaming-${Date.now()}`,
          role: 'assistant',
          content: (prev?.content || '') + event.chunk,
          reasoning: prev?.reasoning || '',
          status: 'streaming',
          isThinking: false,
        }))
      } else if (event.type === 'complete') {
        setStreamingMessage(null)
        setActiveStreamId(null)

        // Add completed message to local state
        setAllMessages((prev) => [...prev, event.message])

        // Mark thread as persisted
        if (thread.status !== 'persisted') {
          onThreadUpdate({
            type: 'UPDATE_STATUS',
            id: thread.id,
            status: 'persisted',
          })
        }
      } else if (event.type === 'error') {
        error('ui', `Stream error: ${event.error}`)
        setStreamingMessage(null)
        setActiveStreamId(null)
        setErrorMessage(event.error)
      }
    })

    return cleanup
  }, [activeStreamId, thread.id, thread.status, onThreadUpdate])

  // Cancel stream on unmount (GC cleanup)
  useEffect(() => {
    return () => {
      if (activeStreamId) {
        stopAIChat(activeStreamId)
      }
    }
  }, [activeStreamId])

  const handleSendMessage = async (content: string, attachments?: AttachmentInput[]) => {
    if (!selectedModel) return

    setErrorMessage(null)

    try {
      // EDITING FLOW
      if (editingState !== null) {
        // ASSISTANT MESSAGE EDIT: Update in place
        if (editingState.role === 'assistant') {
          await updateMessage(thread.id, editingState.messageId, content)

          const { messages: updatedMessages } = await getMessages(thread.id)
          setAllMessages(updatedMessages)
          setEditingState(null)
          return
        }

        // USER MESSAGE EDIT: Create new branch
        const editIndex = messages.findIndex((m) => m.id === editingState.messageId)
        const parentId = editIndex > 0 ? messages[editIndex - 1].id : null

        await createBranch(
          thread.id,
          parentId,
          content,
          selectedModel.id,
          selectedModel.provider.id,
          attachments,
        )

        const { messages: updatedMessages } = await getMessages(thread.id)
        setAllMessages(updatedMessages)

        // Auto-select the new branch
        const selectionKey = parentId ?? 'root'
        const childrenAtParent = updatedMessages.filter((m) => m.parentId === parentId)
        const newBranchIndex = childrenAtParent.length - 1
        setBranchSelections((prev) => ({ ...prev, [selectionKey]: newBranchIndex }))
        setBranchSelection(thread.id, parentId, newBranchIndex)

        setEditingState(null)

        // Start AI response
        onThreadUpdate({
          type: 'UPDATE_STATUS',
          id: thread.id,
          status: 'streaming',
        })

        const { streamId } = await startAIChat(thread.id, selectedModel.id)
        setActiveStreamId(streamId)
        setStreamingMessage({
          id: `streaming-${streamId}`,
          role: 'assistant',
          content: '',
          reasoning: '',
          status: 'streaming',
          isThinking: false,
        })

        return
      }

      // NORMAL FLOW: New message
      const lastMessage = messages[messages.length - 1]
      const parentId = lastMessage?.id ?? null

      const userMessage = await createMessage(
        thread.id,
        'user',
        content,
        parentId,
        selectedModel.id,
        selectedModel.provider.id,
        attachments,
      )

      setAllMessages((prev) => [...prev, userMessage])

      onThreadUpdate({
        type: 'UPDATE_STATUS',
        id: thread.id,
        status: 'streaming',
      })

      const { streamId } = await startAIChat(thread.id, selectedModel.id)
      setActiveStreamId(streamId)
      setStreamingMessage({
        id: `streaming-${streamId}`,
        role: 'assistant',
        content: '',
        reasoning: '',
        status: 'streaming',
        isThinking: false,
      })
    } catch (err) {
      error('ui', 'Send message failed', err as Error)
      setStreamingMessage(null)
      setActiveStreamId(null)
      setErrorMessage(err instanceof Error ? err.message : 'An error occurred while sending message')
    } finally {
      setEditingState(null)
    }
  }

  const handleStopStreaming = useCallback(() => {
    if (activeStreamId) {
      stopAIChat(activeStreamId)
      setStreamingMessage(null)
      setActiveStreamId(null)
    }
  }, [activeStreamId])

  const handleEditMessage = useCallback((content: string, messageId: string, role: MessageRole) => {
    setEditingState({ messageId, role })
    composerRef.current?.setMessage(content)
    composerRef.current?.focus()
  }, [])

  const handleCancelEdit = useCallback(() => {
    setEditingState(null)
    composerRef.current?.setMessage('')
  }, [])

  const handleBranchSwitch = useCallback((branchParentId: string | null, index: number) => {
    const key = branchParentId ?? 'root'
    setBranchSelections((prev) => ({ ...prev, [key]: index }))
    setBranchSelection(thread.id, branchParentId, index)
  }, [thread.id])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Per-chat header with model selector */}
      <header className="flex h-14 items-center border-b border-sidebar-border px-6 shrink-0">
        <ModelSelector
          selectedModel={selectedModel}
          onModelSelect={setSelectedModel}
          models={models}
        />
      </header>

      {messages.length === 0 && !streamingMessage ? (
        <div className="flex flex-1 min-h-0 items-center justify-center">
          <EmptyState />
        </div>
      ) : (
        <div className="relative flex-1 min-h-0">
          <ScrollArea className="h-full" onViewportMount={setViewport}>
            <div className="min-h-full p-6">
              {messages.map((message, index) => {
                const parentId = index === 0 ? null : messages[index - 1].id
                const branchInfo = branchPoints.find((bp) => bp.parentId === parentId)
                return (
                  <Message
                    key={message.id}
                    message={message}
                    onEdit={(content) => handleEditMessage(content, message.id, message.role)}
                    isEditing={editingState?.messageId === message.id}
                    branchInfo={branchInfo}
                    onBranchSwitch={(targetIndex) => handleBranchSwitch(parentId, targetIndex)}
                  />
                )
              })}
              {streamingMessage && (
                <Message
                  key={streamingMessage.id}
                  message={{
                    ...streamingMessage,
                    conversationId: thread.id,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    parentId: messages.length > 0 ? messages[messages.length - 1].id : null,
                  }}
                  isThinking={streamingMessage.isThinking}
                  onEdit={(content) => handleEditMessage(content, streamingMessage.id, 'assistant')}
                  isEditing={editingState?.messageId === streamingMessage.id}
                />
              )}
            </div>
          </ScrollArea>

          {!isAtBottom && activeStreamId && (
            <button
              onClick={scrollToBottom}
              className="absolute bottom-4 right-6 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-opacity hover:bg-primary/90"
              aria-label="Scroll to bottom"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      <div className="shrink-0">
        {errorMessage && (
          <div className="mx-4 mb-2 rounded-md bg-destructive/10 px-3 py-2 text-label text-destructive select-text cursor-text">
            {errorMessage}
          </div>
        )}
        <Composer
          ref={composerRef}
          onSend={handleSendMessage}
          onStop={handleStopStreaming}
          isStreaming={activeStreamId !== null}
          isEditing={editingState !== null}
          onCancelEdit={handleCancelEdit}
        />
      </div>
    </div>
  )
}
