import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { SidebarTrigger } from "@/components/ui/sidebar"

export default function Workbench() {
  return (
    <div className="relative h-full">
      <ScrollArea className="h-full">
        <header className="sticky top-0 z-10 flex h-[var(--header-h)] items-center px-[var(--content-px)] bg-background/50 backdrop-blur-sm">
          <SidebarTrigger />
        </header>
        <div className="space-y-4 px-[var(--content-px)] py-4">
          {Array.from({ length: 40 }, (_, i) => (
            <div key={i} className="rounded-lg bg-muted p-4">
              <span className="text-foreground text-sm">Item {i + 1}</span>
            </div>
          ))}
        </div>
        <ScrollBar className="mt-[var(--header-h)]" />
      </ScrollArea>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-background/100 to-transparent" />
    </div>
  )
}
