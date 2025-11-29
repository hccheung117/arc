import { SidebarGroup, SidebarGroupLabel, SidebarGroupContent, SidebarMenu } from '@renderer/components/ui/sidebar'
import { SidebarItem } from './sidebar-item'
import type { ChatThread } from './chat-thread'
import type { Dispatch } from 'react'
import type { ThreadAction } from './use-chat-threads'

interface SidebarListProps {
  threads: ChatThread[]
  activeThreadId: string | null
  onThreadSelect: (threadId: string | null) => void
  dispatch: Dispatch<ThreadAction>
}

export function SidebarList({ threads, activeThreadId, onThreadSelect, dispatch }: SidebarListProps) {
  // Filter out draft threads that haven't been started yet
  const validThreads = threads.filter((thread) => thread.status !== 'draft')

  const pinnedThreads = validThreads.filter(t => t.isPinned)
  const recentThreads = validThreads.filter(t => !t.isPinned)

  return (
    <>
      {pinnedThreads.length > 0 && (
        <SidebarGroup className="p-0">
          <SidebarGroupLabel>Pinned</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {pinnedThreads.map((thread) => (
                <SidebarItem
                  key={thread.id}
                  thread={thread}
                  isActive={activeThreadId === thread.id}
                  onSelect={(id) => onThreadSelect(id)}
                  dispatch={dispatch}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      )}

      <SidebarGroup className="flex-1 p-0">
        <SidebarGroupLabel>Recent</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {recentThreads.map((thread) => (
              <SidebarItem
                key={thread.id}
                thread={thread}
                isActive={activeThreadId === thread.id}
                onSelect={(id) => onThreadSelect(id)}
                dispatch={dispatch}
              />
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  )
}
