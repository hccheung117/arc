import { SidebarTrigger } from "@/components/ui/sidebar"
import WorkbenchToolbar from "@/components/WorkbenchToolbar"

export default function WorkbenchHeader({
  isPopout, title, mode, hasPrompt,
  onOpenWorkspace, onPopout, onDownload, onTogglePrompt, hasMessages,
}) {
  return (
    <header className="sticky top-0 z-10 flex shrink-0 h-(--header-h) items-center justify-between px-(--content-px) bg-background/50 backdrop-blur-sm">
      <div className="flex items-center gap-2 min-w-0">
        {!isPopout && <SidebarTrigger />}
        <span className="text-sm font-semibold truncate">{title || "Arc"}</span>
      </div>
      <WorkbenchToolbar
        isPopout={isPopout}
        mode={mode}
        hasPrompt={hasPrompt}
        onOpenWorkspace={onOpenWorkspace}
        onPopout={onPopout}
        onDownload={onDownload}
        onTogglePrompt={onTogglePrompt}
        hasMessages={hasMessages}
      />
    </header>
  )
}
