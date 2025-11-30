import { useEffect, useState, useCallback, useRef } from 'react'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { TooltipProvider } from '@renderer/components/ui/tooltip'
import { Composer, type ComposerRef } from './composer'
import { EmptyState } from './empty-state'
import { Message } from './message'
import { ModelSelector } from './model-selector'
import type { Model } from '@arc-types/models'
import type { AttachmentInput, BranchInfo } from '@arc-types/arc-api'
import { getModels, onModelsEvent } from '@renderer/lib/models'
import { getMessages, createMessage, createBranch, switchBranch, startAIChat, stopAIChat, onAIEvent } from '@renderer/lib/messages'
import type { ChatThread } from './chat-thread'
import { createDraftThread } from './chat-thread'
import type { ThreadAction } from './use-chat-threads'
import { useAutoScroll } from './use-auto-scroll'
import { ChevronDown } from 'lucide-react'

interface WorkspaceProps {
  threads: ChatThread[]
  activeThreadId: string | null
  onThreadUpdate: (action: ThreadAction) => void
  onActiveThreadChange: (threadId: string) => void
}

interface StreamingMessage {
  id: string
  role: 'assistant'
  content: string
  reasoning: string
  status: 'streaming'
  isThinking: boolean
}

export function Workspace({ threads, activeThreadId, onThreadUpdate, onActiveThreadChange }: WorkspaceProps) {
  const [models, setModels] = useState<Model[]>([])
  const [selectedModel, setSelectedModel] = useState<Model | null>(null)
  const [streamingMessage, setStreamingMessage] = useState<StreamingMessage | null>(null)
  const [activeStreamId, setActiveStreamId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [branchPoints, setBranchPoints] = useState<BranchInfo[]>([])
  const composerRef = useRef<ComposerRef>(null)

  // State for scroll viewport element to enable smart auto-scroll
  // Using state (not ref) ensures effects re-run when element mounts
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null)
  const { isAtBottom, scrollToBottom } = useAutoScroll(viewport, streamingMessage?.content, activeThreadId)

  // Find the active thread
  const activeThread = threads.find((t) => t.id === activeThreadId)
  const messages = activeThread?.messages || []

  // Persist model selection to localStorage
  useEffect(() => {
    if (selectedModel) {
      localStorage.setItem('arc:selectedModelId', selectedModel.id)
    }
  }, [selectedModel])

  useEffect(() => {
    const fetchModels = () => {
      getModels().then((fetchedModels) => {
        setModels(fetchedModels)
        
        setSelectedModel((prev) => {
          if (prev) {
            // Optional: Verify the selected model still exists in the new list
            // For now, we keep the selection to avoid disruption
            return prev
          }

          if (fetchedModels.length > 0) {
            // Try to restore last selection from localStorage
            const savedModelId = localStorage.getItem('arc:selectedModelId')
            const savedModel = savedModelId
              ? fetchedModels.find((m) => m.id === savedModelId)
              : null
            // Use saved model if found, otherwise default to first available
            return savedModel || fetchedModels[0]
          }
          
          return null
        })
      })
    }

    // Initial fetch
    fetchModels()

    // Listen for model updates from backend
    const unsubscribe = onModelsEvent((event) => {
      if (event.type === 'updated') {
        fetchModels()
      }
    })

    return unsubscribe
  }, [])

  // Load messages when thread is selected
  useEffect(() => {
    if (!activeThread) {
      setBranchPoints([])
      return
    }

    // Only fetch if messages haven't been loaded yet and it's not a fresh draft
    // (Drafts start with 0 messages anyway, but persisted threads might need hydration)
    if (activeThread.messages.length === 0 && activeThread.status !== 'draft') {
      getMessages(activeThread.id).then(({ messages: fetchedMessages, branchPoints: fetchedBranchPoints }) => {
        onThreadUpdate({
          type: 'UPDATE_MESSAGES',
          id: activeThread.id,
          messages: fetchedMessages,
        })
        setBranchPoints(fetchedBranchPoints)
      })
    }
  }, [activeThreadId, activeThread?.status])

  // Set up streaming event listeners
  useEffect(() => {
    const cleanup = onAIEvent((event) => {
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

        // Find thread by matching ID
        const thread = threads.find((t) => t.id === event.message.conversationId)
        if (thread) {
          onThreadUpdate({
            type: 'ADD_MESSAGE',
            id: thread.id,
            message: event.message,
          })
          
          // If it was a draft or streaming, mark as persisted now
          if (thread.status !== 'persisted') {
            onThreadUpdate({
              type: 'UPDATE_STATUS',
              id: thread.id,
              status: 'persisted',
            })
          }
        }
      } else if (event.type === 'error') {
        console.error(`[UI] Stream error: ${event.error}`)
        setStreamingMessage(null)
        setActiveStreamId(null)
        setError(event.error)
      }
    })

    return cleanup
  }, [activeStreamId, threads, onThreadUpdate])

  const handleSendMessage = async (content: string, attachments?: AttachmentInput[]) => {
    if (!selectedModel) return

    setError(null)

    try {
      // EDITING FLOW: Create new branch (preserves old conversation)
      if (editingMessageId !== null && activeThread) {
        // Find the parent message (message BEFORE the one being edited)
        const editIndex = messages.findIndex((m) => m.id === editingMessageId)
        const parentId = editIndex > 0 ? messages[editIndex - 1].id : null

        const { message: newMessage, branchPoints: newBranchPoints } = await createBranch(
          activeThread.id,
          parentId,
          content,
          selectedModel.id,
          selectedModel.provider.id,
          attachments,
        )

        // Reload messages to get the new active path
        const { messages: updatedMessages, branchPoints: updatedBranchPoints } = await getMessages(activeThread.id)
        onThreadUpdate({
          type: 'UPDATE_MESSAGES',
          id: activeThread.id,
          messages: updatedMessages,
        })
        setBranchPoints(updatedBranchPoints)

        // Clear editing state before starting AI
        setEditingMessageId(null)

        // Start streaming for AI response
        onThreadUpdate({
          type: 'UPDATE_STATUS',
          id: activeThread.id,
          status: 'streaming',
        })

        const { streamId } = await startAIChat(activeThread.id, selectedModel.id)
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

      // NORMAL FLOW: Create new message
      let threadId: string

      if (activeThreadId === null) {
        // Create new thread with unified ID
        const thread = createDraftThread()
        threadId = thread.id

        onThreadUpdate({
          type: 'CREATE_DRAFT',
          id: threadId,
        })

        onActiveThreadChange(threadId)
      } else {
        threadId = activeThreadId
        if (!activeThread) return
      }

      // Get parent ID (last message in current conversation)
      const lastMessage = messages[messages.length - 1]
      const parentId = lastMessage?.id ?? null

      const userMessage = await createMessage(
        threadId,
        'user',
        content,
        parentId,
        selectedModel.id,
        selectedModel.provider.id,
        attachments,
      )

      onThreadUpdate({
        type: 'ADD_MESSAGE',
        id: threadId,
        message: userMessage,
      })

      // Start streaming - thread status update handled by reducer/effects if needed
      // or we can explicitly set to streaming here
      onThreadUpdate({
        type: 'UPDATE_STATUS',
        id: threadId,
        status: 'streaming',
      })

      const { streamId } = await startAIChat(threadId, selectedModel.id)
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
      console.error(`[UI] Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
      setStreamingMessage(null)
      setActiveStreamId(null)
      setError(err instanceof Error ? err.message : 'An error occurred while sending message')
    } finally {
      // Always clear editing state after sending
      setEditingMessageId(null)
    }
  }

  const handleStopStreaming = useCallback(() => {
    if (activeStreamId) {
      stopAIChat(activeStreamId)
      setStreamingMessage(null)
      setActiveStreamId(null)
    }
  }, [activeStreamId])

  const handleEditMessage = useCallback((content: string, messageId: string) => {
    setEditingMessageId(messageId)
    composerRef.current?.setMessage(content)
    composerRef.current?.focus()
  }, [])

  const handleCancelEdit = useCallback(() => {
    setEditingMessageId(null)
    composerRef.current?.setMessage('')
  }, [])

  const handleBranchSwitch = useCallback(async (branchParentId: string | null, index: number) => {
    if (!activeThread) return

    try {
      const { messages: newMessages, branchPoints: newBranchPoints } = await switchBranch(
        activeThread.id,
        branchParentId,
        index,
      )

      onThreadUpdate({
        type: 'UPDATE_MESSAGES',
        id: activeThread.id,
        messages: newMessages,
      })
      setBranchPoints(newBranchPoints)
    } catch (err) {
      console.error(`[UI] Branch switch error: ${err instanceof Error ? err.message : 'Unknown error'}`)
      setError(err instanceof Error ? err.message : 'Failed to switch branch')
    }
  }, [activeThread, onThreadUpdate])

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col overflow-hidden">
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
          /**
           * Message List Scroll Container
           *
           * ## Auto-Scroll Behavior
           *
           * This ScrollArea implements smart auto-scroll for AI streaming:
           *
           * | User Position | AI Streaming | Behavior                       |
           * |---------------|--------------|--------------------------------|
           * | At bottom     | Yes          | Auto-scroll follows content    |
           * | Scrolled up   | Yes          | No scroll, show "↓" button     |
           * | At bottom     | No           | Static, no auto-scroll         |
           * | Scrolled up   | No           | Static, no button              |
           *
           * The viewportRef is passed to useAutoScroll hook which:
           * 1. Attaches scroll listener to detect position
           * 2. Triggers scrollToBottom when content updates (if at bottom)
           * 3. Returns isAtBottom for button visibility
           *
           * ## Why viewportRef on ScrollArea?
           *
           * Radix ScrollArea wraps content in a Viewport element that handles
           * actual scrolling. We need direct access to this element's scroll
           * properties (scrollTop, scrollHeight, clientHeight) to implement
           * position detection.
           *
           * @see use-auto-scroll.ts for detailed behavior documentation
           */
          <div className="relative flex-1 min-h-0">
            <ScrollArea className="h-full" onViewportMount={setViewport}>
              <div className="min-h-full p-6">
                {messages.map((message, index) => {
                  // Branch info for this message: check if it was edited (has siblings)
                  // For the first message, check parentId === null; otherwise check the previous message
                  const parentId = index === 0 ? null : messages[index - 1].id
                  const branchInfo = branchPoints.find((bp) => bp.parentId === parentId)
                  console.log(`[Branch] msg=${message.id.slice(0,8)} idx=${index} parentId=${parentId} branchInfo=`, branchInfo, 'all branchPoints=', branchPoints)
                  return (
                    <Message
                      key={message.id}
                      message={message}
                      onEdit={(content) => handleEditMessage(content, message.id)}
                      isEditing={editingMessageId === message.id}
                      branchInfo={branchInfo}
                      onBranchSwitch={(targetIndex) => handleBranchSwitch(parentId, targetIndex)}
                    />
                  )
                })}
                {streamingMessage && activeThread && (
                  <Message
                    key={streamingMessage.id}
                    message={{
                      ...streamingMessage,
                      conversationId: activeThread.id,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    }}
                    isThinking={streamingMessage.isThinking}
                    onEdit={(content) => handleEditMessage(content, streamingMessage.id)}
                    isEditing={editingMessageId === streamingMessage.id}
                  />
                )}
              </div>
            </ScrollArea>

            {/**
             * Scroll-to-Bottom Button
             *
             * Appears when:
             * 1. AI is streaming (!isAtBottom && activeStreamId)
             * 2. User has scrolled up to read previous content
             *
             * Purpose:
             * - Provides a quick way to return to "watching" mode
             * - Visual indicator that new content is appearing below
             * - Clicking scrolls to bottom AND re-engages auto-scroll
             *
             * Design decisions:
             * - Positioned above composer to avoid obscuring input
             * - Uses subtle styling to not distract from content
             * - Only shows during streaming (not for static content)
             *   because scrolling up in a static conversation is normal reading
             *
             * @see use-auto-scroll.ts for the underlying scroll logic
             */}
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
          {/**
           * Typography: Error messages use text-label (15px) to match form controls
           * and maintain consistency with other interactive UI elements.
           *
           * @see tailwind.config.js - Typography scale definition
           */}
          {error && (
            <div className="mx-4 mb-2 rounded-md bg-destructive/10 px-3 py-2 text-label text-destructive">
              {error}
            </div>
          )}
          <Composer 
            ref={composerRef} 
            onSend={handleSendMessage} 
            onStop={handleStopStreaming} 
            isStreaming={activeStreamId !== null}
            isEditing={editingMessageId !== null}
            onCancelEdit={handleCancelEdit}
          />
        </div>
      </div>
    </TooltipProvider>
  )
}
