import { BookOpenIcon, BotIcon, FilePenIcon, FileTextIcon, FolderOpenIcon, GlobeIcon, PencilIcon, TerminalSquareIcon, WrenchIcon } from "lucide-react"

const tools = {
  read_file: {
    icon: FileTextIcon,
    label: (input, done) => {
      const filename = input?.path?.split('/').pop()
      return done
        ? (filename ? `Read ${filename}` : 'Read a file')
        : (filename ? `Reading ${filename}` : 'Reading a file')
    },
    summary: (count) => `Read ${count} file${count > 1 ? 's' : ''}`,
  },
  list_dir: {
    icon: FolderOpenIcon,
    label: (input, done) => {
      const dirname = input?.path?.split('/').pop()
      return done
        ? (dirname ? `Listed ${dirname}` : 'Listed a directory')
        : (dirname ? `Listing ${dirname}` : 'Listing a directory')
    },
    summary: (count) => `Listed ${count} director${count > 1 ? 'ies' : 'y'}`,
  },
  write_file: {
    icon: FilePenIcon,
    label: (input, done) => {
      const filename = input?.path?.split('/').pop()
      return done
        ? (filename ? `Wrote ${filename}` : 'Wrote a file')
        : (filename ? `Writing ${filename}` : 'Writing a file')
    },
    summary: (count) => `Wrote ${count} file${count > 1 ? 's' : ''}`,
  },
  edit_file: {
    icon: PencilIcon,
    label: (input, done) => {
      const filename = input?.path?.split('/').pop()
      return done
        ? (filename ? `Edited ${filename}` : 'Edited a file')
        : (filename ? `Editing ${filename}` : 'Editing a file')
    },
    summary: (count) => `Edited ${count} file${count > 1 ? 's' : ''}`,
  },
  load_skill: {
    icon: BookOpenIcon,
    label: (input, done) => done
      ? `Loaded ${input?.name ?? 'a'} skill`
      : `Loading ${input?.name ?? 'a'} skill`,
    summary: (count) => `Loaded ${count} skill${count > 1 ? 's' : ''}`,
  },
  run_file: {
    icon: TerminalSquareIcon,
    label: (input, done) => {
      const scriptPath = input?.file?.split('/').pop()
      return done
        ? (scriptPath ? `Ran ${scriptPath}` : 'Ran a script')
        : (scriptPath ? `Running ${scriptPath}` : 'Running a script')
    },
    summary: (count) => `Ran ${count} script${count > 1 ? 's' : ''}`,
  },
  browser: {
    icon: GlobeIcon,
    label: (input, done) => {
      const cmd = input?.command ? ` (${input.command})` : ''
      return done ? `Used browser${cmd}` : `Using browser${cmd}`
    },
    summary: (count) => `Used browser ${count} time${count > 1 ? 's' : ''}`,
  },
  subagent: {
    icon: BotIcon,
    label: (input, done) => {
      const name = input?.name ?? 'an agent'
      return done ? `Ran ${name} agent` : `Running ${name} agent`
    },
    summary: (count) => `Used ${count} agent${count > 1 ? 's' : ''}`,
  },
}

const defaults = { icon: WrenchIcon, label: (_, done) => done ? 'Worked' : 'Working...' }

export const toolUI = (name) => ({ ...defaults, ...tools[name] })

export const toolSummary = (steps) => {
  const count = steps.length
  if (count === 0) return null
  const first = tools[steps[0].toolName]
  if (first?.summary && steps.every(s => s.toolName === steps[0].toolName))
    return first.summary(count)
  return `Used ${count} tool${count > 1 ? 's' : ''}`
}
