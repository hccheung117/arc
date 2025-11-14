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
import { getMessages, addUserMessage, addAssistantMessage } from '@/lib/core/messages'
import { getProviderConfig } from '@/lib/core/providers'
import { streamChat } from '@/lib/core/openai'
import type { ChatCompletionMessageParam } from '@/lib/core/openai'

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

  const handleSendMessage = async (content: string) => {
    if (!conversationId || !selectedModel) return

    setError(null)

    try {
      const userMessage = await addUserMessage(conversationId, content)
      setMessages((prev) => [...prev, userMessage])

      const providerConfig = await getProviderConfig(selectedModel.provider.id)

      if (!providerConfig.apiKey) {
        setError('API key not configured for this provider')
        return
      }

      const conversationMessages: ChatCompletionMessageParam[] = [
        ...messages.map((msg) => ({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
        })),
        { role: 'user' as const, content: userMessage.content },
      ]

      const tempId = `streaming-${Date.now()}`
      setStreamingMessage({
        id: tempId,
        role: 'assistant',
        content: '',
        status: 'streaming',
      })

      let fullContent = ''
      for await (const chunk of streamChat(conversationMessages, {
        model: selectedModel.id,
        apiKey: providerConfig.apiKey,
        baseUrl: providerConfig.baseUrl || undefined,
      })) {
        fullContent += chunk
        setStreamingMessage({
          id: tempId,
          role: 'assistant',
          content: fullContent,
          status: 'streaming',
        })
      }

      setStreamingMessage(null)

      const assistantMessage = await addAssistantMessage(conversationId, fullContent)
      setMessages((prev) => [...prev, assistantMessage])
    } catch (err) {
      setStreamingMessage(null)
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
