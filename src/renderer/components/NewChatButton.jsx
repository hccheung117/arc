import { useState } from "react"
import { ChevronDownIcon, Drama, SquarePen, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useSubscription } from "@/hooks/use-subscription"

function PersonaMenuItem({ name, onRemove }) {
  return (
    <DropdownMenuItem className="group/item">
      <Drama />
      {name}
      <button
        className="group/delete ml-auto opacity-0 group-hover/item:opacity-100"
        onClick={e => {
          e.stopPropagation()
          onRemove()
        }}
      >
        <Trash2 className="size-4 text-muted-foreground group-hover/delete:text-red-500" />
      </button>
    </DropdownMenuItem>
  )
}

export default function NewChatButton() {
  const subscribed = useSubscription('personas', [])
  const [personas, setPersonas] = useState(null)
  const displayPersonas = personas ?? subscribed

  return (
    <ButtonGroup className="w-full">
      <Button variant="outline" size="sm" className="flex-1 justify-start">
        <SquarePen />
        New Chat
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="!pl-2">
            <ChevronDownIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            {displayPersonas.map(name => (
              <PersonaMenuItem
                key={name}
                name={name}
                onRemove={() => setPersonas(prev => (prev ?? subscribed).filter(p => p !== name))}
              />
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </ButtonGroup>
  )
}
