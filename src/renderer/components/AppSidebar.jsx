import { SquarePen } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
} from "@/components/ui/sidebar"

export default function AppSidebar() {
  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="h-12 justify-center">
        <Button variant="outline" size="sm" className="justify-start">
          <SquarePen />
          New Chat
        </Button>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Chat items will go here */}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
