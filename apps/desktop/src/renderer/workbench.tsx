import { useEffect } from 'react'
import { FileDown } from 'lucide-react'
import { SidebarProvider, SidebarInset } from '@renderer/components/ui/sidebar'
import { WorkbenchSidebar } from '@renderer/features/workbench/components/sidebar'
import { Workspace } from '@renderer/features/workbench/components/workspace'
import { useChatThreads } from '@renderer/features/workbench/hooks/use-threads'
import { DropOverlay } from '@renderer/components/drop-overlay'
import { useActiveThread } from '@renderer/hooks/use-active-thread'
import { useProfileImport } from '@renderer/hooks/use-profile-import'
import { streamManager } from '@renderer/features/workbench/stores/stream-manager'

export function WorkbenchWindow() {
  const { threads, dispatch } = useChatThreads()
  const { activeThreadId, select } = useActiveThread(dispatch)
  const { isDragging, notification } = useProfileImport()

  // Initialize stream manager on app startup
  useEffect(() => {
    streamManager.init()
    return () => streamManager.destroy()
  }, [])

  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <DropOverlay
        isVisible={isDragging}
        icon={FileDown}
        title="Drop to install profile"
        description="Release to install .arc profile"
      />

      <WorkbenchSidebar
        threads={threads}
        activeThreadId={activeThreadId}
        onThreadSelect={select}
        dispatch={dispatch}
      />

      <SidebarInset className="overflow-hidden">
        <div className="flex-1 min-w-0 bg-white dark:bg-black h-full">
          <Workspace
            threads={threads}
            activeThreadId={activeThreadId}
            onThreadUpdate={dispatch}
          />
        </div>
      </SidebarInset>

      {notification && (
        <div className="fixed bottom-4 right-4 z-50 rounded-md bg-primary px-4 py-2 text-label text-primary-foreground shadow-lg select-text cursor-text">
          {notification}
        </div>
      )}
    </SidebarProvider>
  )
}
