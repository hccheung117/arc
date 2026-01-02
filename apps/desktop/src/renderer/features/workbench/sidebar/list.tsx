import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
} from '@renderer/components/ui/sidebar'
import { SidebarItem } from './item'
import { groupThreadsByDate } from './thread-grouping'
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

  // Normalize pinned into the same shape as groups for unified rendering
  const allGroups = [
    ...(pinned.length > 0 ? [{ label: 'Pinned', threads: pinned }] : []),
    ...groups,
  ]

  return (
    <>
      {allGroups.map(({ label, threads: groupThreads }) => (
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
