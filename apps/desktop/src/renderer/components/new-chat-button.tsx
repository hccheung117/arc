import { useState } from 'react'
import { PenSquare, ChevronDown, Drama, Trash2 } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@renderer/components/ui/popover'
import { usePersonas } from '@renderer/hooks/use-personas'
import type { Persona } from '@contracts/personas'

interface NewChatButtonProps {
  onNewChat: (persona?: Persona) => void
}

export function NewChatButton({ onNewChat }: NewChatButtonProps) {
  const { personas } = usePersonas()
  const [isOpen, setIsOpen] = useState(false)

  const handlePersonaSelect = (persona?: Persona) => {
    setIsOpen(false)
    onNewChat(persona)
  }

  if (personas.length === 0) {
    return (
      <Button
        className="w-full justify-start gap-2"
        variant="outline"
        onClick={() => onNewChat()}
      >
        <PenSquare className="h-4 w-4" />
        New Chat
      </Button>
    )
  }

  return (
    <div className="flex w-full">
      <Button
        className="flex-1 justify-start gap-2 rounded-r-none border-r-0"
        variant="outline"
        onClick={() => onNewChat()}
      >
        <PenSquare className="h-4 w-4" />
        New Chat
      </Button>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="rounded-l-none border-l-0"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-1" align="end">
          <div className="flex flex-col">
            {personas.map((persona) => (
              <div
                key={persona.name}
                className="group flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent text-left cursor-pointer"
                onClick={() => handlePersonaSelect(persona)}
              >
                <Drama className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate flex-1">{persona.displayName}</span>
                {persona.source === 'user' && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      window.arc.personas.delete({ name: persona.name })
                    }}
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
    </div>
  )
}
