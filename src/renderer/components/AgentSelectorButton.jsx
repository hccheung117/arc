import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CommandInput } from '@/components/ui/command'
import SkillList from '@/components/SkillList'
import { PromptInputButton } from '@/components/ai-elements/prompt-input'
import { AtSignIcon } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useSubscription } from '@/hooks/use-subscription'
import { useTiptap } from '@/contexts/TiptapContext'
import { insertMention } from '@/lib/composer-extensions'

export default function AgentSelectorButton() {
  const [open, setOpen] = useState(false)
  const agents = useSubscription('agents:feed', [])
  const { editor } = useTiptap() ?? {}

  const selectAgent = useCallback((name) => {
    if (!editor) return
    insertMention(editor, { id: name, label: name, mentionType: 'agent' })
    setOpen(false)
  }, [editor])

  if (!agents.length) return null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <PromptInputButton>
          <AtSignIcon className="size-4" />
        </PromptInputButton>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <SkillList skills={agents} onSelect={(agent) => selectAgent(agent.name)}>
          <CommandInput placeholder="Search agents..." />
        </SkillList>
      </PopoverContent>
    </Popover>
  )
}
