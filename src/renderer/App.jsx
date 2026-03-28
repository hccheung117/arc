import { useEffect, useRef, useState } from "react"
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable"
import { SidebarProvider } from "@/components/ui/sidebar"
import { useIsMobile } from "@/hooks/use-mobile"
import { useSubscription } from "@/hooks/use-subscription"
import AppSidebar from "@/components/AppSidebar"
import Workbench from "@/components/Workbench"
import Composer from "@/components/Composer"
import { SessionProvider, useSession } from "@/contexts/SessionContext"

const popoutSessionId = new URLSearchParams(location.search).get('popout')

function ErrorBanner() {
  const { status, error } = useSession()
  if (status !== 'error') return null
  return (
    <p className="px-[var(--content-px)] text-sm text-destructive">
      {error?.message ?? 'An error occurred'}
    </p>
  )
}

function SessionContent({ isPopout }) {
  const bodyRef = useRef(null)
  const footerRef = useRef(null)
  const { id: sessionId } = useSession()
  const popouts = useSubscription('session:popout:feed', [])
  const isPoppedOut = !isPopout && popouts.includes(sessionId)

  /* --footer-h: composer height — see docs/ui-chat-viewport-layout.md */
  useEffect(() => {
    const footer = footerRef.current
    const body = bodyRef.current
    if (!footer || !body) return
    const sync = () => body.style.setProperty("--footer-h", `${footer.offsetHeight}px`)
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(footer)
    return () => ro.disconnect()
  }, [isPoppedOut])

  return (
    <div ref={bodyRef} data-body className="relative h-full">
      <Workbench isPopout={isPopout} />
      {!isPoppedOut && (
        <div
          ref={footerRef}
          className="absolute inset-x-0 bottom-0 z-10 flex max-h-[calc(100%-var(--header-h))] flex-col"
        >
          <ErrorBanner />
          <Composer />
        </div>
      )}
    </div>
  )
}

export default function App() {
  const panelRef = useRef(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const isMobile = useIsMobile()

  const handleOpenChange = (open) => {
    if (open) panelRef.current.expand()
    else panelRef.current.collapse()
  }

  useEffect(() => {
    if (!panelRef.current) return
    if (isMobile) panelRef.current.collapse()
    else panelRef.current.expand()
  }, [isMobile])

  if (popoutSessionId) {
    return (
      <SessionProvider popoutSessionId={popoutSessionId}>
        <SessionContent isPopout />
      </SessionProvider>
    )
  }

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
          <SessionProvider>
            <SessionContent />
          </SessionProvider>
        </ResizablePanel>
      </ResizablePanelGroup>
    </SidebarProvider>
  )
}
