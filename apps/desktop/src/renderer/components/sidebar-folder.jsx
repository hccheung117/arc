import { useEffect } from 'react'
import { ChevronRight, ChevronDown, Folder } from 'lucide-react'
import {
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
} from '@renderer/components/ui/sidebar'
import { useRename } from '@renderer/hooks/use-rename'
import { useThreadContextMenu } from '@renderer/hooks/use-thread-context-menu'
import { useFolderCollapse } from '@renderer/hooks/use-folder-collapse'
import { useSidebarStore } from '@renderer/stores/sidebar-store'
import { ThreadItem, RenameInputField } from './sidebar-thread-item'
import { useSidebar } from './sidebar-context'

// ─────────────────────────────────────────────────────────────
// A folder is a collapsible menu item containing nested threads.
// Uses shadcn's SidebarMenuSub for proper indentation.
// ─────────────────────────────────────────────────────────────

export function FolderItem({
  folder,
  threads,
}) {
  const { folders } = useSidebar()
  const renamingFolderId = useSidebarStore((s) => s.renamingFolderId)
  const setRenamingFolderId = useSidebarStore((s) => s.setRenamingFolderId)
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

  const { handleContextMenu } = useThreadContextMenu({
    thread: folder,
    folders,
    onRename: () => rename.startRenaming(),
    onFolderRename: (folderId) => setRenamingFolderId(folderId),
  })

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={toggle}
        onContextMenu={handleContextMenu}
        className="cursor-pointer select-none"
      >
        <Folder className="h-4 w-4 shrink-0 text-sidebar-foreground/70" />
        {rename.isRenaming ? (
          <RenameInputField rename={rename} />
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
