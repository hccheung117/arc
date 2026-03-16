import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CommandInput } from "@/components/ui/command"
import SkillList from "@/components/SkillList"
import { PromptInputButton } from "@/components/ai-elements/prompt-input"
import { useAppStore } from "@/store/app-store"
import { composerActions, useComposerMode } from "@/hooks/use-composer"
import { BookOpenIcon } from "lucide-react"
import { useCallback, useState } from "react"
import { useSubscription } from "@/hooks/use-subscription"

// [CMD-CHANNEL] Writes to pendingMention via composerActions.insertMention().
// Editor consumes it in ComposerEditor.jsx's pendingMention effect.
// No workbench store involved — [SSOT] the editor document owns mention state.
export default function SkillSelectorButton() {
  const [open, setOpen] = useState(false)
  const skills = useSubscription('skills:feed', [])
  const sid = useAppStore((s) => s.activeSessionId)
  const mode = useComposerMode()

  const selectSkill = useCallback((name) => {
    composerActions.insertMention(sid, mode, name)
    setOpen(false)
  }, [sid, mode])

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
