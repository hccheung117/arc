import { createContext, useContext, useState, type PropsWithChildren, type Dispatch } from 'react'
import type { ThreadAction, ChatThread } from '@renderer/lib/threads'

interface SidebarContextValue {
  activeThreadId: string | null
  onThreadSelect: (threadId: string | null) => void
  dispatch: Dispatch<ThreadAction>
  folders: ChatThread[]
  renamingFolderId: string | null
  setRenamingFolderId: (id: string | null) => void
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

interface SidebarProviderProps {
  activeThreadId: string | null
  onThreadSelect: (threadId: string | null) => void
  dispatch: Dispatch<ThreadAction>
  folders: ChatThread[]
}

export function SidebarProvider({
  children,
  activeThreadId,
  onThreadSelect,
  dispatch,
  folders,
}: PropsWithChildren<SidebarProviderProps>) {
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null)

  return (
    <SidebarContext.Provider value={{ activeThreadId, onThreadSelect, dispatch, folders, renamingFolderId, setRenamingFolderId }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  const ctx = useContext(SidebarContext)
  if (!ctx) throw new Error('useSidebar must be used within SidebarProvider')
  return ctx
}
