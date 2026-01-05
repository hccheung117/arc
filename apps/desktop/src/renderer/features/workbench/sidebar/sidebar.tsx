import { useMemo, type Dispatch } from 'react'
import { PenSquare } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarRail,
} from '@renderer/components/ui/sidebar'
import { SidebarList } from './list'
import { SidebarProvider } from './context'
import { isFolder } from './thread-grouping'
import { createDraftThread, type ChatThread, type ThreadAction } from '@renderer/lib/threads'

interface NewChatButtonProps {
  onThreadSelect: (threadId: string | null) => void
  dispatch: Dispatch<ThreadAction>
}

function NewChatButton({ onThreadSelect, dispatch }: NewChatButtonProps) {
  return (
    <Button
      className="w-full justify-start gap-2"
      variant="outline"
      onClick={() => {
        const draft = createDraftThread()
        dispatch({ type: 'UPSERT', thread: draft })
        onThreadSelect(draft.id)
      }}
    >
      <PenSquare className="h-4 w-4" />
      New Chat
    </Button>
  )
}

interface WorkbenchSidebarProps {
  threads: ChatThread[]
  activeThreadId: string | null
  onThreadSelect: (threadId: string | null) => void
  dispatch: Dispatch<ThreadAction>
}

export function WorkbenchSidebar({ threads, activeThreadId, onThreadSelect, dispatch }: WorkbenchSidebarProps) {
  const folders = useMemo(() => threads.filter(isFolder), [threads])

  return (
    <Sidebar className="p-2 bg-sidebar">
      <SidebarHeader className="p-0 pb-3 bg-sidebar">
        <NewChatButton onThreadSelect={onThreadSelect} dispatch={dispatch} />
      </SidebarHeader>
      <SidebarContent className="p-0 bg-sidebar [&::-webkit-scrollbar]:hidden">
        <SidebarProvider
          activeThreadId={activeThreadId}
          onThreadSelect={onThreadSelect}
          dispatch={dispatch}
          folders={folders}
        >
          <SidebarList threads={threads} />
        </SidebarProvider>
      </SidebarContent>
      <SidebarFooter className="p-0 bg-sidebar" />
      <SidebarRail />
    </Sidebar>
  )
}
