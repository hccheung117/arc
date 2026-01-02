import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
} from '@renderer/components/ui/sidebar'
import { SidebarItem } from './item'
import { groupThreadsByDate } from './domain/thread-grouping'
import type { ChatThread } from '@renderer/features/workbench/chat/thread'
import type { Dispatch } from 'react'
import type { ThreadAction } from '@renderer/features/workbench/chat/use-threads'

interface SidebarListProps {
  threads: ChatThread[]
  activeThreadId: string | null
  onThreadSelect: (threadId: string | null) => void
  dispatch: Dispatch<ThreadAction>
}

export function SidebarList({ threads, activeThreadId, onThreadSelect, dispatch }: SidebarListProps) {
  const { pinned, groups } = groupThreadsByDate(threads)

  return (
    <>
      {pinned.length > 0 && (
        <SidebarGroup className="p-0">
          <SidebarGroupLabel>Pinned</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {pinned.map((thread) => (
                <SidebarItem
                  key={thread.id}
                  thread={thread}
                  isActive={activeThreadId === thread.id}
                  onSelect={onThreadSelect}
                  dispatch={dispatch}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      )}

      {groups.map(({ label, threads: groupThreads }) => (
        <SidebarGroup key={label} className="p-0">
          <SidebarGroupLabel>{label}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {groupThreads.map((thread) => (
                <SidebarItem
                  key={thread.id}
                  thread={thread}
                  isActive={activeThreadId === thread.id}
                  onSelect={onThreadSelect}
                  dispatch={dispatch}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  )
}
