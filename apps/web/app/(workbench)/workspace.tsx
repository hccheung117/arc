'use client'

import { useState } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Composer } from './composer'
import { EmptyState } from './empty-state'
import { Message } from './message'
import { ModelSelector } from './model-selector'
import type { Model } from '@arc/core/models/types'
import { models } from '@arc/core/models/mockdata'
import { getMessages } from '@arc/core/messages/api'

interface WorkspaceProps {
  conversationId: string | null
}

export function Workspace({ conversationId }: WorkspaceProps) {
  const [selectedModel, setSelectedModel] = useState<Model>(
    models.find((m) => m.id === 'claude-3-5-sonnet') || models[0]
  )

  const messages = conversationId ? getMessages(conversationId) : []

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col overflow-hidden">
        <header className="flex h-14 items-center border-b border-sidebar-border px-6 shrink-0">
          <ModelSelector
            selectedModel={selectedModel}
            onModelSelect={setSelectedModel}
          />
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
