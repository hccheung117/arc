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
import { getMessages } from '@/lib/core/messages'

interface WorkspaceProps {
  conversationId: string | null
}

export function Workspace({ conversationId }: WorkspaceProps) {
  const [models, setModels] = useState<Model[]>([])
  const [selectedModel, setSelectedModel] = useState<Model | null>(null)
  const [messages, setMessages] = useState<MessageType[]>([])

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
            </div>
          </ScrollArea>
        ) : (
          <div className="flex flex-1 min-h-0 items-center justify-center">
            <EmptyState />
          </div>
        )}

        <div className="shrink-0">
          <Composer />
        </div>
      </div>
    </TooltipProvider>
  )
}
