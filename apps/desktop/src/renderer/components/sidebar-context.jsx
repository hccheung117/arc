import { createContext, useContext, useState } from 'react'

const SidebarContext = createContext(null)

export function SidebarProvider({
  children,
  activeThreadId,
  onThreadSelect,
  dispatch,
  folders,
}) {
  const [renamingFolderId, setRenamingFolderId] = useState(null)

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
