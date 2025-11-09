'use client'

import { ScrollArea } from '@/components/ui/scroll-area'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Composer } from './composer'
import { EmptyState } from './empty-state'
import { Message } from './message'
import { mockMessages } from './mockmsg'

interface WorkspaceProps {
  hasActiveChat: boolean
}

export function Workspace({ hasActiveChat }: WorkspaceProps) {
  return (
    <TooltipProvider>
      <div className="flex h-full flex-col overflow-hidden">
        <header className="flex h-14 items-center border-b border-sidebar-border px-6 shrink-0">
          <h1 className="text-sm font-semibold">
            Claude 3.5 Sonnet
            <span className="ml-2 text-muted-foreground font-normal">Anthropic</span>
          </h1>
        </header>

        {hasActiveChat ? (
          <ScrollArea className="flex-1 min-h-0">
            <div className="min-h-full p-6">
              {mockMessages.map((message) => (
                <Message key={message.id} type={message.type} content={message.content} />
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
