import { createContext, useContext, type PropsWithChildren, type Dispatch } from 'react'
import type { ThreadAction } from '@renderer/lib/threads'

interface SidebarContextValue {
  activeThreadId: string | null
  onThreadSelect: (threadId: string | null) => void
  dispatch: Dispatch<ThreadAction>
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

export function SidebarProvider({
  children,
  activeThreadId,
  onThreadSelect,
  dispatch,
}: PropsWithChildren<SidebarContextValue>) {
  return (
    <SidebarContext.Provider value={{ activeThreadId, onThreadSelect, dispatch }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  const ctx = useContext(SidebarContext)
  if (!ctx) throw new Error('useSidebar must be used within SidebarProvider')
  return ctx
}
