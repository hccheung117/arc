import { useState, useEffect } from 'react'
import { ChevronRight, ChevronDown, Folder } from 'lucide-react'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
} from '@renderer/components/ui/sidebar'
import { getFolderCollapsed, setFolderCollapsed } from '@renderer/lib/ui-state-db'
import { showThreadContextMenu, type ChatThread } from '@renderer/lib/threads'
import { useRename } from './use-rename'
import { ThreadItem } from './thread-item'
import { useSidebar } from './context'

// ─────────────────────────────────────────────────────────────
// A folder is a collapsible container for threads.
// This file builds up from primitives to the final component.
// ─────────────────────────────────────────────────────────────

// First, we need a way to remember whether the folder is open or closed.
// This hook persists that preference to IndexedDB.

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

// ─────────────────────────────────────────────────────────────
// The folder header is the clickable row showing the folder name.
// It's a pure presentational component with a slot for custom content.
// ─────────────────────────────────────────────────────────────

function FolderHeader({
  title,
  isCollapsed = true,
  children,
}: {
  title: string
  isCollapsed?: boolean
  children?: React.ReactNode
}) {
  const Chevron = isCollapsed ? ChevronRight : ChevronDown

  return (
    <div className="flex items-center gap-2 w-full">
      <Folder className="h-4 w-4 shrink-0 text-sidebar-foreground/70" />
      <div className="flex-1 min-w-0">
        {children ?? <span className="truncate block">{title}</span>}
      </div>
      <Chevron className="h-4 w-4 shrink-0 text-sidebar-foreground/50" />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// The folder content is the indented list of threads inside.
// Empty folders show a placeholder message.
// ─────────────────────────────────────────────────────────────

function FolderContent({ threads }: { threads: ChatThread[] }) {
  return (
    <SidebarGroupContent>
      <SidebarMenu className="w-auto mx-3.5 min-w-0 translate-x-px border-l border-sidebar-border px-2.5 py-0.5">
        {threads.length === 0 ? (
          <SidebarMenuItem>
            <div className="px-2 py-1.5 text-meta text-sidebar-foreground/50 italic">
              Empty folder
            </div>
          </SidebarMenuItem>
        ) : (
          threads.map((thread) => <ThreadItem key={thread.id} thread={thread} isInFolder />)
        )}
      </SidebarMenu>
    </SidebarGroupContent>
  )
}

// ─────────────────────────────────────────────────────────────
// Now we compose everything into the full folder view.
// This is the stateful component that handles user interactions.
// ─────────────────────────────────────────────────────────────

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
      className="w-full bg-transparent border-none outline-none text-meta h-4 p-0 text-sidebar-foreground min-w-0"
    />
  )
}

export function FolderView({
  folder,
  threads,
}: {
  folder: ChatThread
  threads: ChatThread[]
}) {
  const { folders, renamingFolderId, setRenamingFolderId } = useSidebar()
  const { isCollapsed, toggle } = useFolderCollapse(folder.id)
  const rename = useRename({ id: folder.id, initialTitle: folder.title })

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
      threadId: folder.id,
      isPinned: folder.isPinned,
      isInFolder: false,
      folders: folders.filter((f) => f.id !== folder.id).map((f) => ({ id: f.id, title: f.title })),
    })
    if (action === 'rename') {
      rename.startRenaming()
    } else if (action?.startsWith('newFolder:')) {
      const folderId = action.slice('newFolder:'.length)
      setRenamingFolderId(folderId)
    }
  }

  return (
    <SidebarGroup className="p-0">
      <SidebarGroupLabel
        className="cursor-pointer select-none"
        onClick={toggle}
        onContextMenu={handleContextMenu}
      >
        <FolderHeader title={folder.title} isCollapsed={isCollapsed}>
          {rename.isRenaming ? <RenameInput rename={rename} /> : null}
        </FolderHeader>
      </SidebarGroupLabel>

      {!isCollapsed && <FolderContent threads={threads} />}
    </SidebarGroup>
  )
}
