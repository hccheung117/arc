import { useEffect, useRef, useState } from "react"
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { useIsMobile } from "@/hooks/use-mobile"
import AppSidebar from "@/components/AppSidebar"

export default function App() {
  const panelRef = useRef(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const isMobile = useIsMobile()

  const handleOpenChange = (open) => {
    if (open) panelRef.current.expand()
    else panelRef.current.collapse()
  }

  useEffect(() => {
    if (isMobile) panelRef.current.collapse()
    else panelRef.current.expand()
  }, [isMobile])

  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={handleOpenChange}>
      <ResizablePanelGroup direction="horizontal" className="h-full">
        <ResizablePanel
          panelRef={panelRef}
          defaultSize="280px"
          collapsible
          onResize={() => setSidebarOpen(!panelRef.current.isCollapsed())}
          className="bg-sidebar"
        >
          <AppSidebar />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel className="bg-background">
          <div className="flex h-full flex-col">
            <header className="flex h-12 items-center px-3">
              <SidebarTrigger />
            </header>
            <div className="flex flex-1 items-center justify-center">
              <span className="text-foreground text-sm">Workbench</span>
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </SidebarProvider>
  )
}
