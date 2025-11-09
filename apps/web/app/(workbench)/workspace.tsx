'use client'

import { ScrollArea } from '@/components/ui/scroll-area'
import { Composer } from './composer'

export function Workspace() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex h-14 items-center border-b border-sidebar-border px-6 flex-shrink-0">
        <h1 className="text-sm font-semibold">
          Claude 3.5 Sonnet
          <span className="ml-2 text-muted-foreground font-normal">Anthropic</span>
        </h1>
      </header>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-6">{/* Message content will go here */}</div>
      </ScrollArea>

      <div className="flex-shrink-0">
        <Composer />
      </div>
    </div>
  )
}
