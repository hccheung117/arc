import { createContext, useContext } from 'react'

const SidebarContext = createContext(null)

export function SidebarProvider({
  children,
  activeThreadId,
  onThreadSelect,
  dispatch,
  folders,
}) {
  return (
    <SidebarContext.Provider value={{ activeThreadId, onThreadSelect, dispatch, folders }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  const ctx = useContext(SidebarContext)
  if (!ctx) throw new Error('useSidebar must be used within SidebarProvider')
  return ctx
}
