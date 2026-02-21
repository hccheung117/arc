import { useEffect, useRef, useState } from "react"
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable"
import { SidebarProvider } from "@/components/ui/sidebar"
import { useIsMobile } from "@/hooks/use-mobile"
import AppSidebar from "@/components/AppSidebar"
import Workbench from "@/components/Workbench"
import Composer from "@/components/Composer"

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
      <ResizablePanelGroup orientation="horizontal" className="h-full">
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
          <ResizablePanelGroup orientation="vertical">
            <ResizablePanel>
              <Workbench />
            </ResizablePanel>
            <ResizableHandle className="bg-transparent aria-[orientation=horizontal]:after:w-12 aria-[orientation=horizontal]:after:left-1/2 aria-[orientation=horizontal]:after:-translate-x-1/2 aria-[orientation=horizontal]:after:rounded-full" />
            <ResizablePanel defaultSize="200px" minSize="100px" maxSize="50%">
              <Composer />
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </SidebarProvider>
  )
}
