import { useEffect, useState } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Composer } from './composer'
import { EmptyState } from './empty-state'
import { Message } from './message'
import { ModelSelector } from './model-selector'
import type { Model } from '../../../types/models'
import type { Message as MessageType } from '../../../types/messages'
import { getModels } from '@/lib/models'
import { getMessages, createMessage, startAIChat, onAIEvent } from '@/lib/messages'
import type { ChatThread } from './chat-thread'
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
  status: 'streaming'
}

export function Workspace({ threads, activeThreadId, onThreadUpdate, onActiveThreadChange }: WorkspaceProps) {
  const [models, setModels] = useState<Model[]>([])
  const [selectedModel, setSelectedModel] = useState<Model | null>(null)
  const [streamingMessage, setStreamingMessage] = useState<StreamingMessage | null>(null)
  const [activeStreamId, setActiveStreamId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Find the active thread
  const activeThread = threads.find((t) => t.threadId === activeThreadId)
  const messages = activeThread?.messages || []

  // Persist model selection to localStorage
  useEffect(() => {
    if (selectedModel) {
      localStorage.setItem('arc:selectedModelId', selectedModel.id)
    }
  }, [selectedModel])

  useEffect(() => {
    getModels().then((fetchedModels) => {
      setModels(fetchedModels)
      if (!selectedModel && fetchedModels.length > 0) {
        // Try to restore last selection from localStorage
        const savedModelId = localStorage.getItem('arc:selectedModelId')
        const savedModel = savedModelId
          ? fetchedModels.find((m) => m.id === savedModelId)
          : null
        // Use saved model if found, otherwise default to first available
        setSelectedModel(savedModel || fetchedModels[0])
      }
    })
  }, [])

  // Load messages when thread is selected and has a conversationId
  useEffect(() => {
    if (!activeThread || !activeThread.conversationId) {
      return
    }

    // Only fetch if messages haven't been loaded yet
    if (activeThread.messages.length === 0) {
      getMessages(activeThread.conversationId).then((fetchedMessages) => {
        onThreadUpdate({
          type: 'UPDATE_MESSAGES',
          threadId: activeThread.threadId,
          messages: fetchedMessages,
        })
      })
    }
  }, [activeThreadId, activeThread?.conversationId])

  // Set up streaming event listeners
  useEffect(() => {
    const cleanup = onAIEvent((event) => {
      if (event.streamId !== activeStreamId) return

      if (event.type === 'delta') {
        setStreamingMessage((prev) => ({
          id: prev?.id || `streaming-${Date.now()}`,
          role: 'assistant',
          content: (prev?.content || '') + event.chunk,
          status: 'streaming',
        }))
      } else if (event.type === 'complete') {
        setStreamingMessage(null)
        setActiveStreamId(null)

        const thread = threads.find((t) => t.conversationId === event.message.conversationId)
        if (thread) {
          onThreadUpdate({
            type: 'ADD_MESSAGE',
            threadId: thread.threadId,
            message: event.message,
          })
          onThreadUpdate({
            type: 'UPDATE_STATUS',
            threadId: thread.threadId,
            status: 'persisted',
          })
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

  const handleSendMessage = async (content: string) => {
    if (!selectedModel) return

    setError(null)

    try {
      let threadId: string
      let conversationId: string

      if (activeThreadId === null) {
        threadId = crypto.randomUUID()
        conversationId = crypto.randomUUID()

        onThreadUpdate({
          type: 'CREATE_DRAFT',
          threadId,
        })

        onThreadUpdate({
          type: 'SET_CONVERSATION_ID',
          threadId,
          conversationId,
        })

        onActiveThreadChange(threadId)
      } else {
        threadId = activeThreadId
        if (!activeThread) return

        conversationId = activeThread.conversationId || crypto.randomUUID()
        if (!activeThread.conversationId) {
          onThreadUpdate({
            type: 'SET_CONVERSATION_ID',
            threadId,
            conversationId,
          })
        }
      }

      const userMessage = await createMessage(conversationId, 'user', content)

      onThreadUpdate({
        type: 'ADD_MESSAGE',
        threadId,
        message: userMessage,
      })

      const { streamId } = await startAIChat(conversationId, selectedModel.id)
      setActiveStreamId(streamId)
      setStreamingMessage({
        id: `streaming-${streamId}`,
        role: 'assistant',
        content: '',
        status: 'streaming',
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
                    conversationId: activeThread.conversationId || '',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  }}
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
