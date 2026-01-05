import { useMemo } from 'react'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
} from '@renderer/components/ui/sidebar'
import { ThreadItem } from './thread-item'
import { FolderView } from './folder'
import { groupThreadsWithFolders } from './thread-grouping'
import type { ChatThread } from '@renderer/lib/threads'

interface SidebarListProps {
  threads: ChatThread[]
}

export function SidebarList({ threads }: SidebarListProps) {
  const { folders, pinned, groups } = useMemo(() => groupThreadsWithFolders(threads), [threads])

  const allGroups = useMemo(() => [
    ...(pinned.length > 0 ? [{ label: 'Pinned', threads: pinned }] : []),
    ...groups,
  ], [pinned, groups])

  return (
    <>
      {folders.map(({ folder, threads: folderThreads }) => (
        <FolderView
          key={folder.id}
          folder={folder}
          threads={folderThreads}
        />
      ))}

      {allGroups.map(({ label, threads: groupThreads }) => (
        <SidebarGroup key={label} className="p-0">
          <SidebarGroupLabel>{label}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {groupThreads.map((thread) => (
                <ThreadItem
                  key={thread.id}
                  thread={thread}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  )
}
