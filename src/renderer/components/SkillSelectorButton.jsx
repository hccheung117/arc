import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CommandInput } from "@/components/ui/command"
import SkillList from "@/components/SkillList"
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
        <SkillList skills={skills} onSelect={(skill) => selectSkill(skill.name)}>
          <CommandInput placeholder="Search skills..." />
        </SkillList>
      </PopoverContent>
    </Popover>
  )
}
