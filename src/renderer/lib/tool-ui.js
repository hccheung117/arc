import { BookOpenIcon, FileTextIcon, WrenchIcon } from "lucide-react"

const tools = {
  read: {
    icon: FileTextIcon,
    label: (input) => {
      const filename = input?.path?.split('/').pop()
      return filename ? `Reading ${filename}` : 'Reading a file'
    },
    summary: (count) => `Read ${count} file${count > 1 ? 's' : ''}`,
  },
  load_skill: {
    icon: BookOpenIcon,
    label: (input) => `Loading ${input?.name ?? 'a skill'} skill`,
    summary: (count) => `Loaded ${count} skill${count > 1 ? 's' : ''}`,
  },
}

const defaults = { icon: WrenchIcon, label: () => 'Working...' }

export const toolUI = (name) => ({ ...defaults, ...tools[name] })

export const toolSummary = (steps) => {
  const count = steps.length
  if (count === 0) return null
  const first = tools[steps[0].toolName]
  if (first?.summary && steps.every(s => s.toolName === steps[0].toolName))
    return first.summary(count)
  return `Used ${count} tool${count > 1 ? 's' : ''}`
}
