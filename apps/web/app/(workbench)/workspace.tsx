'use client'

import { useEffect, useState } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Composer } from './composer'
import { EmptyState } from './empty-state'
import { Message } from './message'
import { ModelSelector } from './model-selector'
import type { Model } from '@arc/contracts/src/models'
import type { Message as MessageType } from '@arc/contracts/src/messages'
import { getModels } from '@/lib/core/models'
import { getMessages, streamMessage, onStreamDelta, onStreamComplete, onStreamError } from '@/lib/core/messages'

interface WorkspaceProps {
  conversationId: string | null
}

interface StreamingMessage {
  id: string
  role: 'assistant'
  content: string
  status: 'streaming'
}

export function Workspace({ conversationId }: WorkspaceProps) {
  const [models, setModels] = useState<Model[]>([])
  const [selectedModel, setSelectedModel] = useState<Model | null>(null)
  const [messages, setMessages] = useState<MessageType[]>([])
  const [streamingMessage, setStreamingMessage] = useState<StreamingMessage | null>(null)
  const [activeStreamId, setActiveStreamId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getModels().then((fetchedModels) => {
      setModels(fetchedModels)
      if (!selectedModel && fetchedModels.length > 0) {
        setSelectedModel(
          fetchedModels.find((m) => m.id === 'claude-3-5-sonnet') || fetchedModels[0]
        )
      }
    })
  }, [])

  useEffect(() => {
    if (conversationId) {
      getMessages(conversationId).then(setMessages)
    } else {
      setMessages([])
    }
  }, [conversationId])

  // Set up streaming event listeners
  useEffect(() => {
    const cleanupDelta = onStreamDelta((event) => {
      if (event.streamId === activeStreamId) {
        setStreamingMessage((prev) => ({
          id: prev?.id || `streaming-${Date.now()}`,
          role: 'assistant',
          content: (prev?.content || '') + event.chunk,
          status: 'streaming',
        }))
      }
    })

    const cleanupComplete = onStreamComplete((event) => {
      if (event.streamId === activeStreamId) {
        setStreamingMessage(null)
        setActiveStreamId(null)
        setMessages((prev) => [...prev, event.message])
      }
    })

    const cleanupError = onStreamError((event) => {
      if (event.streamId === activeStreamId) {
        setStreamingMessage(null)
        setActiveStreamId(null)
        setError(event.error)
      }
    })

    return () => {
      cleanupDelta()
      cleanupComplete()
      cleanupError()
    }
  }, [activeStreamId])

  const handleSendMessage = async (content: string) => {
    if (!conversationId || !selectedModel) return

    setError(null)

    try {
      // Initiate streaming via IPC
      const { streamId, messageId } = await streamMessage(
        conversationId,
        selectedModel.id,
        content
      )

      // Add user message optimistically
      const userMessage: MessageType = {
        id: messageId,
        conversationId,
        role: 'user',
        status: 'complete',
        content,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, userMessage])

      // Set up streaming state
      setActiveStreamId(streamId)
      setStreamingMessage({
        id: `streaming-${streamId}`,
        role: 'assistant',
        content: '',
        status: 'streaming',
      })
    } catch (err) {
      setStreamingMessage(null)
      setActiveStreamId(null)
      setError(err instanceof Error ? err.message : 'An error occurred while sending message')
    }
  }

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col overflow-hidden">
        <header className="flex h-14 items-center border-b border-sidebar-border px-6 shrink-0">
          {selectedModel && (
            <ModelSelector
              selectedModel={selectedModel}
              onModelSelect={setSelectedModel}
              models={models}
            />
          )}
        </header>

        {conversationId ? (
          <ScrollArea className="flex-1 min-h-0">
            <div className="min-h-full p-6">
              {messages.map((message) => (
                <Message key={message.id} message={message} />
              ))}
              {streamingMessage && (
                <Message
                  key={streamingMessage.id}
                  message={{
                    ...streamingMessage,
                    conversationId,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  }}
                />
              )}
            </div>
          </ScrollArea>
        ) : (
          <div className="flex flex-1 min-h-0 items-center justify-center">
            <EmptyState />
          </div>
        )}

        <div className="shrink-0">
          {error && (
            <div className="mx-4 mb-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <Composer onSend={handleSendMessage} disabled={!conversationId || !!streamingMessage} />
        </div>
      </div>
    </TooltipProvider>
  )
}
