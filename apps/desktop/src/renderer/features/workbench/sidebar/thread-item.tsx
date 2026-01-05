import { MessageSquare, MoreHorizontal } from 'lucide-react'
import {
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
} from '@renderer/components/ui/sidebar'
import { showThreadContextMenu, type ChatThread } from '@renderer/lib/threads'
import { useSidebar } from './context'
import { useRename } from './use-rename'

const ThreadIcon = () => (
  <MessageSquare className="h-4 w-4 shrink-0 text-sidebar-foreground/70" />
)

// Pure component for rename mode - receives hook return as props
function RenameInput({ rename }: { rename: ReturnType<typeof useRename> }) {
  return (
    <SidebarMenuItem>
      {/* text-label matches navigation item sizing per tailwind.config.js */}
      <div className="flex items-center gap-2 px-2 py-1.5 w-full">
        <ThreadIcon />
        <input
          ref={rename.inputRef}
          type="text"
          value={rename.renameValue}
          onChange={(e) => rename.setRenameValue(e.target.value)}
          onBlur={rename.saveRename}
          onKeyDown={rename.handleKeyDown}
          className="flex-1 bg-transparent border-none outline-none text-label h-5 p-0 text-sidebar-foreground min-w-0"
        />
      </div>
    </SidebarMenuItem>
  )
}

interface ThreadItemProps {
  thread: ChatThread
  isInFolder?: boolean
}

export function ThreadItem({ thread, isInFolder = false }: ThreadItemProps) {
  const { activeThreadId, onThreadSelect, folders, setRenamingFolderId } = useSidebar()
  const rename = useRename({ id: thread.id, initialTitle: thread.title })

  const handleContextMenu = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const action = await showThreadContextMenu({
      threadId: thread.id,
      isPinned: thread.isPinned,
      isInFolder,
      folders: folders.map((f) => ({ id: f.id, title: f.title })),
    })
    if (action === 'rename') {
      rename.startRenaming()
    } else if (action?.startsWith('newFolder:')) {
      const folderId = action.slice('newFolder:'.length)
      setRenamingFolderId(folderId)
    }
  }

  if (rename.isRenaming) return <RenameInput rename={rename} />

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={activeThreadId === thread.id}
        onClick={() => onThreadSelect(thread.id)}
        onContextMenu={handleContextMenu}
        className="group/item"
      >
        <ThreadIcon />
        <span className="truncate">{thread.title}</span>
      </SidebarMenuButton>
      <SidebarMenuAction showOnHover onClick={handleContextMenu}>
        <MoreHorizontal />
        <span className="sr-only">More</span>
      </SidebarMenuAction>
    </SidebarMenuItem>
  )
}
