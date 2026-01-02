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
import { createDraftThread, type ChatThread } from '@renderer/features/workbench/chat/thread'
import type { ThreadAction } from '@renderer/features/workbench/chat/use-threads'
import type { Dispatch } from 'react'

interface WorkbenchSidebarProps {
  threads: ChatThread[]
  activeThreadId: string | null
  onThreadSelect: (threadId: string | null) => void
  dispatch: Dispatch<ThreadAction>
}

export function WorkbenchSidebar({ threads, activeThreadId, onThreadSelect, dispatch }: WorkbenchSidebarProps) {
  return (
    <Sidebar className="p-2 bg-sidebar">
      <SidebarHeader className="p-0 pb-3 bg-sidebar">
        <Button
          className="w-full justify-start gap-2"
          variant="outline"
          onClick={() => {
            const draft = createDraftThread()
            dispatch({ type: 'CREATE_DRAFT', id: draft.id })
            onThreadSelect(draft.id)
          }}
        >
          <PenSquare className="h-4 w-4" />
          New Chat
        </Button>
      </SidebarHeader>
      <SidebarContent className="p-0 bg-sidebar">
        <SidebarList
          threads={threads}
          activeThreadId={activeThreadId}
          onThreadSelect={onThreadSelect}
          dispatch={dispatch}
        />
      </SidebarContent>
      <SidebarFooter className="p-0 bg-sidebar" />
      <SidebarRail />
    </Sidebar>
  )
}
