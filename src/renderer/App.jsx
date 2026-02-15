import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable"

export default function App() {
  return (
    <ResizablePanelGroup direction="horizontal" className="h-full">
      <ResizablePanel className="bg-sidebar">
        <div className="flex h-full items-center justify-center">
          <span className="text-sidebar-foreground text-sm">Sidebar</span>
        </div>
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel className="bg-background">
        <div className="flex h-full items-center justify-center">
          <span className="text-foreground text-sm">Workbench</span>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
