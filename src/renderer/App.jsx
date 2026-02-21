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
  const bodyRef = useRef(null)
  const footerRef = useRef(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const isMobile = useIsMobile()

  useEffect(() => {
    const footer = footerRef.current
    const body = bodyRef.current
    if (!footer || !body) return
    const sync = () => body.style.setProperty("--footer-h", `${footer.offsetHeight}px`)
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(footer)
    return () => ro.disconnect()
  }, [])

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
          <div ref={bodyRef} data-body className="relative h-full">
            <Workbench />
            {/* Flex-column chain: this container's max-h is the single source of
                truth for the composer's height limit. It propagates down via
                flex + min-h-0 on each descendant, so the textarea shrinks and
                scrolls automatically — no magic calc() values needed deeper. */}
            <div
              ref={footerRef}
              className="absolute inset-x-0 bottom-0 z-10 flex max-h-[calc(100%-var(--header-h))] flex-col"
            >
              <Composer />
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </SidebarProvider>
  )
}
