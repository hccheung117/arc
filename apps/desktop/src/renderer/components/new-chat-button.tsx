import { useState } from 'react'
import { PenSquare, ChevronDown } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { PersonaSelector } from '@renderer/components/persona-selector'
import { usePersonas } from '@renderer/hooks/use-personas'
import type { Persona } from '@contracts/personas'

interface NewChatButtonProps {
  onNewChat: (persona?: Persona) => void
}

export function NewChatButton({ onNewChat }: NewChatButtonProps) {
  const { personas } = usePersonas()
  const [isOpen, setIsOpen] = useState(false)

  const handlePersonaSelect = (persona: Persona) => {
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
      <PersonaSelector
        personas={personas}
        open={isOpen}
        onOpenChange={setIsOpen}
        onSelect={handlePersonaSelect}
        trigger={
          <Button
            variant="outline"
            size="icon"
            className="rounded-l-none border-l-0"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        }
      />
    </div>
  )
}
