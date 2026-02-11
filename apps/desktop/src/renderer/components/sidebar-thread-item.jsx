import { MessageSquare } from 'lucide-react'
import {
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from '@renderer/components/ui/sidebar'
import { useSidebar } from './sidebar-context'
import { useSidebarStore } from '@renderer/stores/sidebar-store'
import { useRename } from '@renderer/hooks/use-rename'
import { useThreadContextMenu } from '@renderer/hooks/use-thread-context-menu'

const ThreadIcon = () => (
  <MessageSquare className="h-4 w-4 shrink-0 text-sidebar-foreground/70" />
)

export function RenameInputField({ rename }) {
  return (
    <input
      ref={rename.inputRef}
      type="text"
      value={rename.renameValue}
      onChange={(e) => rename.setRenameValue(e.target.value)}
      onBlur={rename.saveRename}
      onKeyDown={rename.handleKeyDown}
      className="flex-1 bg-transparent border-none outline-none text-label h-5 p-0 text-sidebar-foreground min-w-0"
    />
  )
}

export function ThreadItem({ thread, variant = 'default' }) {
  const { activeThreadId, onThreadSelect, folders } = useSidebar()
  const setRenamingFolderId = useSidebarStore((s) => s.setRenamingFolderId)
  const rename = useRename({ id: thread.id, initialTitle: thread.title })
  const isNested = variant === 'nested'

  // Add folderId to thread object for hook to detect isInFolder
  const threadWithFolderId = { ...thread, folderId: isNested ? 'nested' : undefined }

  const { handleContextMenu } = useThreadContextMenu({
    thread: threadWithFolderId,
    folders,
    onRename: () => rename.startRenaming(),
    onFolderRename: (folderId) => setRenamingFolderId(folderId),
  })

  // Rename mode
  if (rename.isRenaming) {
    const Wrapper = isNested ? SidebarMenuSubItem : SidebarMenuItem
    const py = isNested ? 'py-1' : 'py-1.5'
    return (
      <Wrapper>
        <div className={`flex items-center gap-2 px-2 ${py} w-full`}>
          <ThreadIcon />
          <RenameInputField rename={rename} />
        </div>
      </Wrapper>
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
