import { useState } from 'react'
import { SidebarProvider, SidebarInset } from '@renderer/components/ui/sidebar'
import { WorkbenchSidebar } from '@renderer/features/workbench/sidebar'
import { Workspace } from '@renderer/features/workbench/workspace'
import { useChatThreads } from '@renderer/features/workbench/use-chat-threads'

export function WorkbenchWindow() {
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

