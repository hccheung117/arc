import { useEffect, useState } from 'react'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { TooltipProvider } from '@renderer/components/ui/tooltip'
import { Composer } from './composer'
import { EmptyState } from './empty-state'
import { Message } from './message'
import { ModelSelector } from './model-selector'
import type { Model } from '@arc-types/models'
import type { AttachmentInput } from '@arc-types/arc-api'
import { getModels, onModelsEvent } from '@renderer/lib/models'
import { getMessages, createMessage, startAIChat, onAIEvent } from '@renderer/lib/messages'
import type { ChatThread } from './chat-thread'
import { createDraftThread } from './chat-thread'
import type { ThreadAction } from './use-chat-threads'

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
      return
    }

    // Only fetch if messages haven't been loaded yet and it's not a fresh draft
    // (Drafts start with 0 messages anyway, but persisted threads might need hydration)
    if (activeThread.messages.length === 0 && activeThread.status !== 'draft') {
      getMessages(activeThread.id).then((fetchedMessages) => {
        onThreadUpdate({
          type: 'UPDATE_MESSAGES',
          id: activeThread.id,
          messages: fetchedMessages,
        })
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

      const userMessage = await createMessage(
        threadId,
        'user',
        content,
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
    }
  }

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
          <ScrollArea className="flex-1 min-h-0">
            <div className="min-h-full p-6">
              {messages.map((message) => (
                <Message key={message.id} message={message} />
              ))}
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
                />
              )}
            </div>
          </ScrollArea>
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
          <Composer onSend={handleSendMessage} isStreaming={activeStreamId !== null} />
        </div>
      </div>
    </TooltipProvider>
  )
}
