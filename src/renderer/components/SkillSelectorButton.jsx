import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CommandInput } from '@/components/ui/command'
import SkillList from '@/components/SkillList'
import { PromptInputButton } from '@/components/ai-elements/prompt-input'
import { BookOpenIcon } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useSubscription } from '@/hooks/use-subscription'
import { useTiptap } from '@/contexts/TiptapContext'

export default function SkillSelectorButton() {
  const [open, setOpen] = useState(false)
  const skills = useSubscription('skills:feed', [])
  const { editor } = useTiptap() ?? {}

  const selectSkill = useCallback((name) => {
    if (!editor) return
    editor.chain().focus().insertContent([
      { type: 'mention', attrs: { id: name, label: name, mentionType: 'skill' } },
      { type: 'text', text: ' ' },
    ]).run()
    setOpen(false)
  }, [editor])

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
