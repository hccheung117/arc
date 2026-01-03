import { useState, useRef, useEffect } from 'react'
import { MessageSquare, MoreHorizontal } from 'lucide-react'
import { SidebarMenuItem, SidebarMenuButton, SidebarMenuAction } from '@renderer/components/ui/sidebar'
import { showThreadContextMenu, renameThread, type ChatThread, type ThreadAction } from '@renderer/lib/threads'
import type { Dispatch } from 'react'

interface SidebarItemProps {
  thread: ChatThread
  isActive: boolean
  onSelect: (threadId: string) => void
  dispatch: Dispatch<ThreadAction>
}

export function SidebarItem({ thread, isActive, onSelect, dispatch }: SidebarItemProps) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(thread.title)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isRenaming])

  const handleContextMenu = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // Data actions (delete, togglePin) are handled in main process.
    // State updates come via event listener in use-chat-threads.ts.
    const action = await showThreadContextMenu(thread.id, thread.isPinned)

    if (action === 'rename') {
      startRenaming()
    }
  }

  const startRenaming = () => {
    setRenameValue(thread.title)
    setIsRenaming(true)
  }

  const handleSaveRename = async () => {
    if (!renameValue.trim()) {
      setIsRenaming(false)
      setRenameValue(thread.title)
      return
    }

    await renameThread(thread.id, renameValue)

    dispatch({ type: 'RENAME_THREAD', id: thread.id, title: renameValue })
    setIsRenaming(false)
  }

  const handleCancelRename = () => {
    setIsRenaming(false)
    setRenameValue(thread.title)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSaveRename()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancelRename()
    }
  }

  if (isRenaming) {
    return (
      <SidebarMenuItem>
        {/**
         * Typography: Rename input uses text-label (15px) to match navigation item sizing.
         * This ensures visual consistency when switching between read and edit modes.
         *
         * @see tailwind.config.js - Typography scale definition
         */}
        <div className="flex items-center gap-2 px-2 py-1.5 w-full">
          <MessageSquare className="h-4 w-4 shrink-0 text-sidebar-foreground/70" />
          <input
            ref={inputRef}
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleSaveRename}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent border-none outline-none text-label h-5 p-0 text-sidebar-foreground min-w-0"
          />
        </div>
      </SidebarMenuItem>
    )
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        onClick={() => onSelect(thread.id)}
        onContextMenu={handleContextMenu}
        className="group/item"
      >
        <MessageSquare className="h-4 w-4 text-sidebar-foreground/70" />
        <span className="truncate">{thread.title}</span>
      </SidebarMenuButton>
      <SidebarMenuAction showOnHover onClick={handleContextMenu}>
        <MoreHorizontal />
        <span className="sr-only">More</span>
      </SidebarMenuAction>
    </SidebarMenuItem>
  )
}
