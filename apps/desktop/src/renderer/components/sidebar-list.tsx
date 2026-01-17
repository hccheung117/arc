import { useMemo } from 'react'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
} from '@renderer/components/ui/sidebar'
import { ThreadItem } from './sidebar-thread-item'
import { FolderItem } from './sidebar-folder'
import { groupThreadsWithFolders } from '@renderer/lib/thread-grouping'
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
      {/* Folders rendered as menu items (no section label) */}
      {folders.length > 0 && (
        <SidebarMenu>
          {folders.map(({ folder, threads: folderThreads }) => (
            <FolderItem
              key={folder.id}
              folder={folder}
              threads={folderThreads}
            />
          ))}
        </SidebarMenu>
      )}

      {/* Time-based groups with section labels */}
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
