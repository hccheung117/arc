import { useMemo } from 'react'
import { Drama, Trash2 } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@renderer/components/ui/popover'
import { createTextMeasurer } from '@renderer/lib/measure'

// Module-level measurer (matches text-sm in popover items)
const measureText = createTextMeasurer('14px ui-sans-serif, system-ui, sans-serif')

// Buffer for UI chrome:
// PopoverContent padding (p-1 × 2): 8px + Item padding (px-2 × 2): 16px +
// Gap (gap-2): 8px + Drama icon (h-4 w-4): 16px + Delete icon area: 16px + Scrollbar: 8px
const UI_CHROME_BUFFER = 72

export function PersonaSelector({
  personas,
  open,
  onOpenChange,
  onSelect,
  trigger,
}) {
  const popoverWidth = useMemo(() => {
    if (personas.length === 0) return 180
    const longestWidth = Math.max(...personas.map((p) => measureText(p.displayName)))
    return Math.max(180, Math.min(320, Math.ceil(longestWidth) + UI_CHROME_BUFFER))
  }, [personas])

  const handleDelete = (e, persona) => {
    e.stopPropagation()
    e.preventDefault()
    window.arc.personas.delete({ name: persona.name })
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        className="p-1"
        align="end"
        style={{ width: popoverWidth, maxWidth: '85vw' }}
      >
        <div className="flex flex-col">
          {personas.map((persona) => (
            <div
              key={persona.name}
              className="group flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent text-left cursor-pointer"
              onClick={() => onSelect(persona)}
            >
              <Drama className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate flex-1">{persona.displayName}</span>
              {persona.source === 'user' && (
                <button
                  type="button"
                  onClick={(e) => handleDelete(e, persona)}
                  className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                </button>
              )}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
