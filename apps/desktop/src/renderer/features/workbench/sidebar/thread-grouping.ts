import type { ChatThread } from '@renderer/lib/threads'

export interface FolderGroup {
  folder: ChatThread
  threads: ChatThread[]
}

export interface GroupedThreads {
  folders: FolderGroup[]
  pinned: ChatThread[]
  groups: Array<{ label: string; threads: ChatThread[] }>
}

const GROUP_ORDER = ['Today', 'Yesterday', 'Previous 7 Days', 'Previous 30 Days'] as const

// --- Pure helpers ---

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const daysBetween = (from: Date, to: Date) =>
  (startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000

const partition = <T>(xs: T[], pred: (x: T) => boolean) => [
  xs.filter(pred),
  xs.filter((x) => !pred(x)),
]

const groupBy = <T>(xs: T[], key: (x: T) => string) =>
  xs.reduce(
    (acc, x) => ((acc[key(x)] ??= []).push(x), acc),
    {} as Record<string, T[]>,
  )

// --- Predicates ---

export const isFolder = (t: ChatThread) => t.children.length > 0
const isPinned = (t: ChatThread) => t.isPinned
const isActive = (t: ChatThread) => t.status !== 'draft'

// --- Comparators ---

const byUpdatedAtDesc = (a: ChatThread, b: ChatThread) =>
  new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()

const byGroupOrder =
  (threadsByLabel: Record<string, ChatThread[]>) =>
  (a: string, b: string) => {
    const ia = GROUP_ORDER.indexOf(a as (typeof GROUP_ORDER)[number])
    const ib = GROUP_ORDER.indexOf(b as (typeof GROUP_ORDER)[number])

    if (ia !== -1 && ib !== -1) return ia - ib
    if (ia !== -1) return -1
    if (ib !== -1) return 1

    return byUpdatedAtDesc(threadsByLabel[a][0], threadsByLabel[b][0])
  }

// --- Public API ---

export function getGroupLabel(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const days = daysBetween(date, now)

  if (days < 1) return 'Today'
  if (days < 2) return 'Yesterday'
  if (days <= 7) return 'Previous 7 Days'
  if (days <= 30) return 'Previous 30 Days'

  return date.getFullYear() === now.getFullYear()
    ? date.toLocaleDateString('en-US', { month: 'long' })
    : date.getFullYear().toString()
}

export function groupThreadsWithFolders(threads: ChatThread[]) {
  const active = threads.filter(isActive)

  const [folderThreads, nonFolders] = partition(active, isFolder)
  const [pinned, unpinned] = partition(nonFolders, isPinned)

  const folders = folderThreads.map((folder) => ({
    folder,
    threads: folder.children,
  }))

  const byLabel = groupBy(unpinned, (t) => getGroupLabel(t.updatedAt))

  const groups = Object.keys(byLabel)
    .toSorted(byGroupOrder(byLabel))
    .map((label) => ({
      label,
      threads: byLabel[label].toSorted(byUpdatedAtDesc),
    }))

  return { folders, pinned, groups }
}