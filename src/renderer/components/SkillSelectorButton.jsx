import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { PromptInputButton } from "@/components/ai-elements/prompt-input"
import { act } from "@/store/app-store"
import { BookOpenIcon } from "lucide-react"
import { useCallback, useState } from "react"
import { useSubscription } from "@/hooks/use-subscription"

export default function SkillSelectorButton() {
  const [open, setOpen] = useState(false)
  const skills = useSubscription('skills:feed', [])

  const selectSkill = useCallback((name) => {
    act().workbench.update({ activeSkill: name })
    setOpen(false)
  }, [])

  if (!skills.length) return null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <PromptInputButton>
          <BookOpenIcon className="size-4" />
        </PromptInputButton>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search skills..." />
          <CommandList>
            <CommandEmpty>No skills found.</CommandEmpty>
            <CommandGroup>
              {skills.map((skill) => (
                <CommandItem key={skill.name} value={skill.name} onSelect={() => selectSkill(skill.name)}>
                  <div className="flex-1 min-w-0">
                    <div>{skill.name}</div>
                    <div className="text-xs text-muted-foreground">{skill.description}</div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
