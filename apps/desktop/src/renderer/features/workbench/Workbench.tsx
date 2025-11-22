import { useState } from 'react'
import { WorkbenchSidebar } from './sidebar'
import { Workspace } from './workspace'
import { useChatThreads } from './use-chat-threads'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'

export function Workbench() {
  const { threads, dispatch } = useChatThreads()
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)

  return (
    <SidebarProvider className="h-svh overflow-hidden">
        <WorkbenchSidebar
          threads={threads}
          activeThreadId={activeThreadId}
          onThreadSelect={setActiveThreadId}
          dispatch={dispatch}
        />
      <SidebarInset className="overflow-hidden">
        <div className="flex-1 min-w-0 bg-white dark:bg-black h-full">
        <Workspace
          threads={threads}
          activeThreadId={activeThreadId}
          onThreadUpdate={dispatch}
          onActiveThreadChange={setActiveThreadId}
        />
      </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
