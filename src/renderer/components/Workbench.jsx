import { Drama, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { SidebarTrigger } from "@/components/ui/sidebar"

export default function Workbench() {
  return (
    <div className="relative h-full">
      <ScrollArea className="h-full">
        <header className="sticky top-0 z-10 flex h-[var(--header-h)] items-center justify-between px-[var(--content-px)] bg-background/50 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <span className="text-sm font-semibold">Arc AI</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm"><Drama /></Button>
            <Button variant="ghost" size="icon-sm"><Download /></Button>
          </div>
        </header>
        <div className="space-y-4 px-[var(--content-px)] pt-4" style={{ paddingBottom: "var(--footer-h)" }}>
          {Array.from({ length: 40 }, (_, i) => (
            <div key={i} className="rounded-lg bg-muted p-4">
              <span className="text-foreground text-sm">Item {i + 1}</span>
            </div>
          ))}
        </div>
        <ScrollBar className="mt-[var(--header-h)] mb-[var(--footer-h)]" />
      </ScrollArea>
    </div>
  )
}
