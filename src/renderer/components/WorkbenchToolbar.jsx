import { Drama, FolderOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import WorkbenchMenu from "@/components/WorkbenchMenu"

export default function WorkbenchToolbar({
  isPopout, mode, hasPrompt,
  onOpenWorkspace, onPopout, onDownload, onTogglePrompt, hasMessages,
}) {
  return (
    <div className="flex items-center gap-1">
      <Button onClick={onOpenWorkspace} variant="ghost" size="icon-sm"><FolderOpen /></Button>
      <Button
        variant={mode === "prompt" ? "default" : "ghost"}
        size="icon-sm"
        className="relative"
        onClick={onTogglePrompt}
      >
        <Drama />
        {hasPrompt && mode !== "prompt" && (
          <span className="absolute bottom-[2px] left-1/2 -translate-x-1/2 h-0.5 w-3 rounded-full bg-primary" />
        )}
      </Button>
      <WorkbenchMenu
        isPopout={isPopout}
        onPopout={onPopout}
        onDownload={onDownload}
        hasMessages={hasMessages}
      />
    </div>
  )
}
