import { BookOpenIcon, FilePenIcon, FileTextIcon, FolderOpenIcon, PencilIcon, TerminalSquareIcon, WrenchIcon } from "lucide-react"

const tools = {
  read_file: {
    icon: FileTextIcon,
    label: (input) => {
      const filename = input?.path?.split('/').pop()
      return filename ? `Reading ${filename}` : 'Reading a file'
    },
    summary: (count) => `Read ${count} file${count > 1 ? 's' : ''}`,
  },
  list_dir: {
    icon: FolderOpenIcon,
    label: (input) => {
      const dirname = input?.path?.split('/').pop()
      return dirname ? `Listing ${dirname}` : 'Listing a directory'
    },
    summary: (count) => `Listed ${count} director${count > 1 ? 'ies' : 'y'}`,
  },
  write_file: {
    icon: FilePenIcon,
    label: (input) => {
      const filename = input?.path?.split('/').pop()
      return filename ? `Writing ${filename}` : 'Writing a file'
    },
    summary: (count) => `Wrote ${count} file${count > 1 ? 's' : ''}`,
  },
  edit_file: {
    icon: PencilIcon,
    label: (input) => {
      const filename = input?.path?.split('/').pop()
      return filename ? `Editing ${filename}` : 'Editing a file'
    },
    summary: (count) => `Edited ${count} file${count > 1 ? 's' : ''}`,
  },
  load_skill: {
    icon: BookOpenIcon,
    label: (input) => `Loading ${input?.name ?? 'a skill'} skill`,
    summary: (count) => `Loaded ${count} skill${count > 1 ? 's' : ''}`,
  },
  run_file: {
    icon: TerminalSquareIcon,
    label: (input) => {
      const scriptPath = input?.file?.split('/').pop()
      return scriptPath ? `Running ${scriptPath}` : 'Running a script'
    },
    summary: (count) => `Ran ${count} script${count > 1 ? 's' : ''}`,
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
