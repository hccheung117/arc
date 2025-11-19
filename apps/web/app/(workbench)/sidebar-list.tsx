import { SidebarGroup, SidebarGroupLabel, SidebarGroupContent, SidebarMenu } from '@/components/ui/sidebar'
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
  // Filter out threads with null conversationId (drafts that haven't started) unless they are the active one?
  // Actually, drafts are "New Chat" and should be in the list. The chat-thread logic says they have conversationId: null.
  // The original sidebar filtered: threads.filter((thread) => thread.conversationId !== null)
  // But wait, "New Chat" needs to be accessible. 
  // Typically "New Chat" button creates a draft. If we create a draft, it appears in the list?
  // The original sidebar had a separate "New Chat" button at the top.
  
  // Let's separate Pinned vs Recent.
  const pinnedThreads = threads.filter(t => t.isPinned && t.conversationId !== null)
  const recentThreads = threads.filter(t => !t.isPinned && t.conversationId !== null)

  return (
    <>
      {pinnedThreads.length > 0 && (
        <SidebarGroup className="p-0">
          <SidebarGroupLabel>Pinned</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {pinnedThreads.map((thread) => (
                <SidebarItem
                  key={thread.threadId}
                  thread={thread}
                  isActive={activeThreadId === thread.threadId}
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
                key={thread.threadId}
                thread={thread}
                isActive={activeThreadId === thread.threadId}
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

