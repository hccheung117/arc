import { MessageSquare } from 'lucide-react'
import {
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from '@renderer/components/ui/sidebar'
import {
  showThreadContextMenu,
  deleteThread,
  toggleThreadPin,
  removeThreadFromFolder,
  moveThreadToFolder,
  createFolderWithThread,
  type ChatThread,
} from '@renderer/lib/threads'
import { useSidebar } from './sidebar-context'
import { useRename } from '@renderer/features/workbench/hooks/use-rename'

const ThreadIcon = () => (
  <MessageSquare className="h-4 w-4 shrink-0 text-sidebar-foreground/70" />
)

// Rename input for top-level items
function RenameInput({ rename }: { rename: ReturnType<typeof useRename> }) {
  return (
    <SidebarMenuItem>
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

// Rename input for nested items (inside folders)
function RenameInputNested({ rename }: { rename: ReturnType<typeof useRename> }) {
  return (
    <SidebarMenuSubItem>
      <div className="flex items-center gap-2 px-2 py-1 w-full">
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
    </SidebarMenuSubItem>
  )
}

interface ThreadItemProps {
  thread: ChatThread
  variant?: 'default' | 'nested'
}

export function ThreadItem({ thread, variant = 'default' }: ThreadItemProps) {
  const { activeThreadId, onThreadSelect, folders, setRenamingFolderId } = useSidebar()
  const rename = useRename({ id: thread.id, initialTitle: thread.title })
  const isNested = variant === 'nested'

  const handleContextMenu = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const action = await showThreadContextMenu({
      isPinned: thread.isPinned,
      isInFolder: isNested,
      folders: folders.map((f) => ({ id: f.id, title: f.title })),
    })

    if (!action) return

    // Handle each action by calling the appropriate domain IPC
    switch (action) {
      case 'rename':
        rename.startRenaming()
        break
      case 'delete':
        await deleteThread(thread.id)
        break
      case 'togglePin':
        await toggleThreadPin(thread.id, thread.isPinned)
        break
      case 'removeFromFolder':
        await removeThreadFromFolder(thread.id)
        break
      case 'newFolder': {
        const folder = await createFolderWithThread(thread.id)
        setRenamingFolderId(folder.id)
        break
      }
      default:
        // Handle moveToFolder:folderId
        if (action.startsWith('moveToFolder:')) {
          const folderId = action.slice('moveToFolder:'.length)
          await moveThreadToFolder(thread.id, folderId)
        }
    }
  }

  // Rename mode
  if (rename.isRenaming) {
    return isNested ? (
      <RenameInputNested rename={rename} />
    ) : (
      <RenameInput rename={rename} />
    )
  }

  // Nested variant (inside folders) - uses SidebarMenuSub* components
  if (isNested) {
    return (
      <SidebarMenuSubItem>
        <SidebarMenuSubButton
          asChild
          isActive={activeThreadId === thread.id}
        >
          <button
            type="button"
            onClick={() => onThreadSelect(thread.id)}
            onContextMenu={handleContextMenu}
            className="w-full"
          >
            <ThreadIcon />
            <span className="truncate">{thread.title}</span>
          </button>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
    )
  }

  // Default variant (top-level)
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={activeThreadId === thread.id}
        onClick={() => onThreadSelect(thread.id)}
        onContextMenu={handleContextMenu}
      >
        <ThreadIcon />
        <span className="truncate">{thread.title}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
