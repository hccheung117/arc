import { ALargeSmall, Download, Ellipsis, SquareArrowOutUpRight } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useSubscription } from "@/hooks/use-subscription"
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

export default function WorkbenchMenu({ isPopout, onPopout, onDownload, hasMessages }) {
  const typographySettings = useSubscription('settings:typography', { lineHeight: null })
  const [typographyOpen, setTypographyOpen] = useState(false)

  return (
    <Popover open={typographyOpen} onOpenChange={setTypographyOpen}>
      <DropdownMenu>
        <PopoverAnchor asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm"><Ellipsis /></Button>
          </DropdownMenuTrigger>
        </PopoverAnchor>
        <DropdownMenuContent align="end">
          {!isPopout && <DropdownMenuItem onClick={onPopout}><SquareArrowOutUpRight />Open in New Window</DropdownMenuItem>}
          <DropdownMenuItem disabled={!hasMessages} onClick={onDownload}><Download />Export</DropdownMenuItem>
          {/* rAF defers open until dropdown finishes unmounting */}
          <DropdownMenuItem onSelect={() => requestAnimationFrame(() => setTypographyOpen(true))}><ALargeSmall />Typography</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {/* Dropdown close restores focus to trigger, which fires focusOutside on the
          popover's DismissableLayer — prevent so only pointer-click/Escape dismiss. */}
      <PopoverContent align="end" className="w-fit"
        onFocusOutside={(e) => e.preventDefault()}
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Font</div>
            <ToggleGroup
              type="single"
              variant="outline"
              value={typographySettings.fontFamily ?? "default"}
              onValueChange={(val) => {
                if (!val) return
                window.api.call('settings:set-typography', {
                  fontFamily: val === "default" ? null : val,
                })
              }}
            >
              <ToggleGroupItem value="default">System</ToggleGroupItem>
              <ToggleGroupItem value="noto-serif">Noto Serif</ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Line Height</div>
            <ToggleGroup
              type="single"
              variant="outline"
              value={typographySettings.lineHeight ?? "default"}
              onValueChange={(val) => {
                if (!val) return
                window.api.call('settings:set-typography', {
                  lineHeight: val === "default" ? null : val,
                })
              }}
            >
              <ToggleGroupItem value="default">Default</ToggleGroupItem>
              <ToggleGroupItem value="1.2">Relaxed</ToggleGroupItem>
              <ToggleGroupItem value="1.5">Loose</ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
