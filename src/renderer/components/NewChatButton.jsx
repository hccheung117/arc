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
import { act } from "@/store/app-store"

function PromptMenuItem({ name, source, onSelect, onRemove }) {
  return (
    <DropdownMenuItem className="group/item" onSelect={onSelect}>
      <Drama />
      {name}
      {source === '@app' && (
        <button
          className="group/delete ml-auto opacity-0 group-hover/item:opacity-100"
          onClick={e => {
            e.stopPropagation()
            onRemove()
          }}
        >
          <Trash2 className="size-4 text-muted-foreground group-hover/delete:text-red-500" />
        </button>
      )}
    </DropdownMenuItem>
  )
}

export default function NewChatButton() {
  const prompts = useSubscription('prompt:feed', [])

  const handleNewChat = () => act().session.new()

  if (!prompts.length) {
    return (
      <Button variant="outline" size="sm" className="w-full justify-start" onClick={handleNewChat}>
        <SquarePen />
        New Chat
      </Button>
    )
  }

  return (
    <ButtonGroup className="w-full">
      <Button variant="outline" size="sm" className="flex-1 justify-start" onClick={handleNewChat}>
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
            {prompts.map(({ name, source }) => (
              <PromptMenuItem
                key={name}
                name={name}
                source={source}
                onSelect={() => {
                  act().session.new()
                  act().workbench.update({ promptRef: name })
                }}
                onRemove={() => window.api.call('prompt:remove', { name })}
              />
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </ButtonGroup>
  )
}
