import { useMemo, useCallback, type Dispatch } from 'react'
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarRail,
} from '@renderer/components/ui/sidebar'
import { SidebarList } from './sidebar-list'
import { SidebarProvider } from './sidebar-context'
import { NewChatButton } from './new-chat-button'
import { isFolder } from '@renderer/lib/thread-grouping'
import { createDraftThread, type ChatThread, type ThreadAction } from '@renderer/lib/threads'
import type { Persona } from '@main/modules/personas/business'

interface WorkbenchSidebarProps {
  threads: ChatThread[]
  activeThreadId: string | null
  onThreadSelect: (threadId: string | null) => void
  dispatch: Dispatch<ThreadAction>
}

export function WorkbenchSidebar({ threads, activeThreadId, onThreadSelect, dispatch }: WorkbenchSidebarProps) {
  const folders = useMemo(() => threads.filter(isFolder), [threads])

  const handleNewChat = useCallback(
    (persona?: Persona) => {
      const draft = createDraftThread(
        persona
          ? { promptSource: { type: 'persona', personaId: persona.name } }
          : undefined,
      )
      dispatch({ type: 'UPSERT', thread: draft })
      onThreadSelect(draft.id)
    },
    [dispatch, onThreadSelect],
  )

  return (
    <Sidebar className="p-2 bg-sidebar">
      <SidebarHeader className="p-0 pb-3 bg-sidebar">
        <NewChatButton onNewChat={handleNewChat} />
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
