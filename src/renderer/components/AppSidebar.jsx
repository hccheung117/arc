import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/shadcn"
import { addUnread, clearUnread } from "@/lib/unread"
import { ChevronDownIcon } from "lucide-react"
import { useSubscription } from "@/hooks/use-subscription"
import { useAppStore, act } from "@/store/app-store"
import NewChatButton from "@/components/NewChatButton"
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible"
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar"

function groupChatsByDate(chats) {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfYesterday = new Date(startOfToday - 86400000)
  const startOf7Days = new Date(startOfToday - 6 * 86400000)
  const startOf30Days = new Date(startOfToday - 29 * 86400000)

  const buckets = [
    { label: "Today", items: [], min: startOfToday, max: Infinity },
    { label: "Yesterday", items: [], min: startOfYesterday, max: startOfToday },
    { label: "Previous 7 Days", items: [], min: startOf7Days, max: startOfYesterday },
    { label: "Previous 30 Days", items: [], min: startOf30Days, max: startOf7Days },
  ]

  for (const chat of chats) {
    const t = chat.date.getTime()
    const bucket = buckets.find(b => t >= b.min && t < b.max)
    if (bucket) bucket.items.push(chat)
  }

  return buckets.filter(b => b.items.length > 0)
}

function RenameInput({ defaultValue, onConfirm, onCancel, className }) {
  const ref = useRef(null)

  useEffect(() => {
    ref.current.select()
  }, [])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') onConfirm(e.target.value)
    if (e.key === 'Escape') onCancel()
  }

  return (
    <input
      ref={ref}
      autoFocus
      defaultValue={defaultValue}
      className={cn("h-8 w-full rounded-md bg-transparent px-2 text-sm outline-none", className)}
      onKeyDown={handleKeyDown}
      onBlur={onCancel}
    />
  )
}

function ChatItems({ items, activeSessionId, unreadIds, renamingId, onRename, onCancelRename, onContextMenu }) {
  return (
    <SidebarMenu>
      {items.map(chat => (
        <SidebarMenuItem key={chat.id}>
          {renamingId === chat.id ? (
            <RenameInput
              defaultValue={chat.title}
              onConfirm={(title) => onRename(chat.id, title)}
              onCancel={onCancelRename}
            />
          ) : (
            <SidebarMenuButton
              isActive={chat.id === activeSessionId}
              onClick={() => act().session.activate(chat.id)}
              onContextMenu={(e) => onContextMenu(e, chat.id)}
            >
              <span>{chat.title}</span>
              {unreadIds.has(chat.id) && <span className="ml-auto size-2 rounded-full bg-blue-500" />}
            </SidebarMenuButton>
          )}
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  )
}

export default function AppSidebar() {
  const activeSessionId = useAppStore((s) => s.activeSessionId)
  const [renamingId, setRenamingId] = useState(null)
  const [renamingFolderIndex, setRenamingFolderIndex] = useState(null)
  const feed = useSubscription('session:feed', { sessions: [], folders: [] })
  const chats = feed.sessions.map(c => ({ ...c, date: new Date(c.date) }))
  const folders = feed.folders

  const [unreadIds, setUnreadIds] = useState(() => new Set())

  useEffect(() => window.api.on('session:rename:start', setRenamingId), [])
  useEffect(() => window.api.on('session:folder-rename:start', setRenamingFolderIndex), [])

  useEffect(() => window.api.on('session:responded', (sessionId) => {
    const active = useAppStore.getState().activeSessionId
    setUnreadIds(prev => addUnread(prev, sessionId, active))
  }), [])

  useEffect(() => {
    setUnreadIds(prev => clearUnread(prev, activeSessionId))
  }, [activeSessionId])

  useEffect(() => {
    const { activeSessionId, draftSessionId } = useAppStore.getState()
    if (activeSessionId === draftSessionId) return
    if (chats.length === 0 && feed.sessions.length === 0) return
    if (!chats.some(c => c.id === activeSessionId)) act().session.new()
  }, [chats, feed.sessions.length])

  const folderedIds = new Set(folders.flatMap(f => f.sessions))

  const folderSections = folders.map((folder, i) => ({
    type: 'folder', label: folder.name, folderIndex: i,
    collapsed: folder.collapsed,
    items: folder.sessions.map(sid => chats.find(c => c.id === sid)).filter(Boolean),
  }))

  const pinned = chats.filter(c => c.pinned && !folderedIds.has(c.id))
  const ungrouped = chats.filter(c => !c.pinned && !folderedIds.has(c.id))

  const sections = [
    ...folderSections,
    ...(pinned.length ? [{ type: 'section', label: 'Pinned', items: pinned }] : []),
    ...groupChatsByDate(ungrouped).map(s => ({ type: 'section', ...s })),
  ]

  const handleContextMenu = (e, id) => {
    e.preventDefault()
    window.api.call('session:context-menu', { id })
  }

  const handleFolderContextMenu = (e, folderIndex) => {
    e.preventDefault()
    window.api.call('session:folder-context-menu', { folderIndex })
  }

  const handleRename = (id, title) => {
    window.api.call('session:rename', { id, title })
    setRenamingId(null)
  }

  const handleFolderRename = (folderIndex, name) => {
    window.api.call('session:rename-folder', { folderIndex, name })
    setRenamingFolderIndex(null)
  }

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="h-[var(--header-h)] justify-center">
        <NewChatButton />
      </SidebarHeader>
      <SidebarContent>
        {sections.map(section => section.type === 'folder' ? (
          <Collapsible
            key={`folder-${section.folderIndex}`}
            open={!section.collapsed}
            onOpenChange={() => window.api.call('session:toggle-folder-collapse', { folderIndex: section.folderIndex })}
            className="group/collapsible"
          >
            <SidebarGroup className="pr-0 transition-[padding] duration-200 group-data-[state=closed]/collapsible:py-0">
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger onContextMenu={(e) => handleFolderContextMenu(e, section.folderIndex)}>
                  {renamingFolderIndex === section.folderIndex ? (
                    <RenameInput
                      defaultValue={section.label}
                      onConfirm={(name) => handleFolderRename(section.folderIndex, name)}
                      onCancel={() => setRenamingFolderIndex(null)}
                      className="px-0 text-xs font-medium"
                    />
                  ) : (
                    <>
                      {section.label}
                      <ChevronDownIcon className="ml-auto transition-transform group-data-[state=closed]/collapsible:rotate-[-90deg]" />
                    </>
                  )}
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <ChatItems
                    items={section.items}
                    activeSessionId={activeSessionId}
                    unreadIds={unreadIds}
                    renamingId={renamingId}
                    onRename={handleRename}
                    onCancelRename={() => setRenamingId(null)}
                    onContextMenu={handleContextMenu}
                  />
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        ) : (
          <SidebarGroup key={section.label} className="pr-0">
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <ChatItems
                items={section.items}
                activeSessionId={activeSessionId}
                unreadIds={unreadIds}
                renamingId={renamingId}
                onRename={handleRename}
                onCancelRename={() => setRenamingId(null)}
                onContextMenu={handleContextMenu}
              />
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  )
}
