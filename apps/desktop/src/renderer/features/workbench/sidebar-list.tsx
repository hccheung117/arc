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

function getGroupLabel(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffTime = today.getTime() - target.getTime()
  const diffDays = diffTime / (1000 * 60 * 60 * 24)

  if (diffDays < 1) return 'Today'
  if (diffDays < 2) return 'Yesterday'
  if (diffDays <= 7) return 'Previous 7 Days'
  if (diffDays <= 30) return 'Previous 30 Days'
  
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('en-US', { month: 'long' })
  }
  
  return date.getFullYear().toString()
}

const GROUP_ORDER = [
  'Today',
  'Yesterday',
  'Previous 7 Days',
  'Previous 30 Days'
]

export function SidebarList({ threads, activeThreadId, onThreadSelect, dispatch }: SidebarListProps) {
  // Filter out draft threads that haven't been started yet
  const validThreads = threads.filter((thread) => thread.status !== 'draft')

  const pinnedThreads = validThreads.filter(t => t.isPinned)
  const recentThreads = validThreads.filter(t => !t.isPinned)

  // Group recent threads by date
  const groupedThreads = recentThreads.reduce((acc, thread) => {
    const label = getGroupLabel(thread.createdAt)
    if (!acc[label]) {
      acc[label] = []
    }
    acc[label].push(thread)
    return acc
  }, {} as Record<string, ChatThread[]>)

  // Sort groups
  const sortedGroups = Object.keys(groupedThreads).sort((a, b) => {
    const indexA = GROUP_ORDER.indexOf(a)
    const indexB = GROUP_ORDER.indexOf(b)
    
    if (indexA !== -1 && indexB !== -1) return indexA - indexB
    if (indexA !== -1) return -1
    if (indexB !== -1) return 1
    
    // If both are months/years, sort by most recent thread in the group
    // Assuming threads are already sorted by date desc, we can check the first thread
    const dateA = new Date(groupedThreads[a][0].createdAt).getTime()
    const dateB = new Date(groupedThreads[b][0].createdAt).getTime()
    return dateB - dateA
  })

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

      {sortedGroups.map((label) => (
        <SidebarGroup key={label} className="p-0">
          <SidebarGroupLabel>{label}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {groupedThreads[label].map((thread) => (
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
      ))}
    </>
  )
}
