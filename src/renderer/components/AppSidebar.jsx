import { useEffect, useRef, useState } from "react"
import { useSubscription } from "@/hooks/use-subscription"
import { useAppStore, act } from "@/store/app-store"
import NewChatButton from "@/components/NewChatButton"
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

function RenameInput({ chat, onConfirm, onCancel }) {
  const ref = useRef(null)

  useEffect(() => {
    const input = ref.current
    input.select()
  }, [])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') onConfirm(e.target.value)
    if (e.key === 'Escape') onCancel()
  }

  return (
    <input
      ref={ref}
      autoFocus
      defaultValue={chat.title}
      className="h-8 w-full rounded-md bg-transparent px-2 text-sm outline-none"
      onKeyDown={handleKeyDown}
      onBlur={onCancel}
    />
  )
}

export default function AppSidebar() {
  const activeSessionId = useAppStore((s) => s.activeSessionId)
  const [renamingId, setRenamingId] = useState(null)
  const raw = useSubscription('session:listen', [])
  const chats = raw.map(c => ({ ...c, date: new Date(c.date) }))

  useEffect(() => window.api.on('session:rename-start', setRenamingId), [])

  const pinned = chats.filter(c => c.pinned)
  const sections = [
    ...(pinned.length ? [{ label: "Pinned", items: pinned }] : []),
    ...groupChatsByDate(chats.filter(c => !c.pinned)),
  ]

  const handleContextMenu = (e, id) => {
    e.preventDefault()
    window.api.call('session:context-menu', { id })
  }

  const handleRename = (id, title) => {
    window.api.call('session:rename', { id, title })
    setRenamingId(null)
  }

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="h-[var(--header-h)] justify-center">
        <NewChatButton />
      </SidebarHeader>
      <SidebarContent>
        {sections.map(section => (
          <SidebarGroup key={section.label} className="pr-0">
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map(chat => (
                  <SidebarMenuItem key={chat.id}>
                    {renamingId === chat.id ? (
                      <RenameInput
                        chat={chat}
                        onConfirm={(title) => handleRename(chat.id, title)}
                        onCancel={() => setRenamingId(null)}
                      />
                    ) : (
                      <SidebarMenuButton
                        isActive={chat.id === activeSessionId}
                        onClick={() => act().session.activate(chat.id)}
                        onContextMenu={(e) => handleContextMenu(e, chat.id)}
                      >
                        {chat.title}
                      </SidebarMenuButton>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  )
}
