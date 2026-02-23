import { useEffect, useState } from "react"
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

export default function AppSidebar() {
  const [activeChatId, setActiveChatId] = useState(null)
  const [chats, setChats] = useState([])

  useEffect(() => {
    window.api.call('session:list').then((raw) =>
      setChats(raw.map((c) => ({ ...c, date: new Date(c.date) })))
    )
  }, [])

  const sections = groupChatsByDate(chats)

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
                    <SidebarMenuButton
                      isActive={chat.id === activeChatId}
                      onClick={() => setActiveChatId(chat.id)}
                    >
                      {chat.title}
                    </SidebarMenuButton>
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
