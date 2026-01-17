import { useState, useEffect } from 'react'
import { ChevronRight, ChevronDown, Folder } from 'lucide-react'
import {
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
} from '@renderer/components/ui/sidebar'
import { getFolderCollapsed, setFolderCollapsed } from '@renderer/lib/ui-state-db'
import {
  showThreadContextMenu,
  deleteThread,
  toggleThreadPin,
  moveThreadToFolder,
  createFolderWithThread,
  type ChatThread,
} from '@renderer/lib/threads'
import { useRename } from '@renderer/hooks/use-rename'
import { ThreadItem } from './sidebar-thread-item'
import { useSidebar } from './sidebar-context'

// ─────────────────────────────────────────────────────────────
// A folder is a collapsible menu item containing nested threads.
// Uses shadcn's SidebarMenuSub for proper indentation.
// ─────────────────────────────────────────────────────────────

const useFolderCollapse = (folderId: string) => {
  const [isCollapsed, setIsCollapsed] = useState(false)

  useEffect(() => {
    getFolderCollapsed(folderId).then(setIsCollapsed)
  }, [folderId])

  const toggle = () => {
    const next = !isCollapsed
    setIsCollapsed(next)
    setFolderCollapsed(folderId, next)
  }

  return { isCollapsed, toggle }
}

function RenameInput({ rename }: { rename: ReturnType<typeof useRename> }) {
  return (
    <input
      ref={rename.inputRef}
      type="text"
      value={rename.renameValue}
      onChange={(e) => rename.setRenameValue(e.target.value)}
      onBlur={rename.saveRename}
      onKeyDown={rename.handleKeyDown}
      onClick={(e) => e.stopPropagation()}
      className="flex-1 bg-transparent border-none outline-none text-label h-5 p-0 text-sidebar-foreground min-w-0"
    />
  )
}

export function FolderItem({
  folder,
  threads,
}: {
  folder: ChatThread
  threads: ChatThread[]
}) {
  const { folders, renamingFolderId, setRenamingFolderId } = useSidebar()
  const { isCollapsed, toggle } = useFolderCollapse(folder.id)
  const rename = useRename({ id: folder.id, initialTitle: folder.title })
  const Chevron = isCollapsed ? ChevronRight : ChevronDown

  // Auto-trigger rename mode when this folder was just created via context menu
  useEffect(() => {
    if (renamingFolderId === folder.id) {
      rename.startRenaming()
      setRenamingFolderId(null)
    }
  }, [renamingFolderId, folder.id, rename, setRenamingFolderId])

  const handleContextMenu = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const action = await showThreadContextMenu({
      isPinned: folder.isPinned,
      isInFolder: false,
      folders: folders.filter((f) => f.id !== folder.id).map((f) => ({ id: f.id, title: f.title })),
    })

    if (!action) return

    // Handle each action by calling the appropriate domain IPC
    switch (action) {
      case 'rename':
        rename.startRenaming()
        break
      case 'delete':
        await deleteThread(folder.id)
        break
      case 'togglePin':
        await toggleThreadPin(folder.id, folder.isPinned)
        break
      case 'newFolder': {
        const newFolder = await createFolderWithThread(folder.id)
        setRenamingFolderId(newFolder.id)
        break
      }
      default:
        // Handle moveToFolder:folderId
        if (action.startsWith('moveToFolder:')) {
          const folderId = action.slice('moveToFolder:'.length)
          await moveThreadToFolder(folder.id, folderId)
        }
    }
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={toggle}
        onContextMenu={handleContextMenu}
        className="cursor-pointer select-none"
      >
        <Folder className="h-4 w-4 shrink-0 text-sidebar-foreground/70" />
        {rename.isRenaming ? (
          <RenameInput rename={rename} />
        ) : (
          <span className="truncate">{folder.title}</span>
        )}
        <Chevron className="ml-auto h-4 w-4 shrink-0 text-sidebar-foreground/50" />
      </SidebarMenuButton>

      {!isCollapsed && (
        <SidebarMenuSub className="mr-0 pr-0">
          {threads.length === 0 ? (
            <SidebarMenuSubItem>
              <span className="px-2 py-1 text-meta text-sidebar-foreground/50 italic block">
                Empty folder
              </span>
            </SidebarMenuSubItem>
          ) : (
            threads.map((thread) => (
              <ThreadItem key={thread.id} thread={thread} variant="nested" />
            ))
          )}
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  )
}
