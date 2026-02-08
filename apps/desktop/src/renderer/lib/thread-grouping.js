const GROUP_ORDER = ['Today', 'Yesterday', 'Previous 7 Days', 'Previous 30 Days']

// --- Pure helpers ---

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const daysBetween = (from, to) =>
  (startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000

const partition = (xs, pred) => [
  xs.filter(pred),
  xs.filter((x) => !pred(x)),
]

const groupBy = (xs, key) =>
  xs.reduce(
    (acc, x) => ((acc[key(x)] ??= []).push(x), acc),
    {},
  )

// --- Predicates ---

export const isFolder = (t) => t.children.length > 0
const isPinned = (t) => t.isPinned
const isActive = (t) => t.status !== 'draft'

// --- Comparators ---

const byUpdatedAtDesc = (a, b) =>
  new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()

const byGroupOrder =
  (threadsByLabel) =>
  (a, b) => {
    const ia = GROUP_ORDER.indexOf(a)
    const ib = GROUP_ORDER.indexOf(b)

    if (ia !== -1 && ib !== -1) return ia - ib
    if (ia !== -1) return -1
    if (ib !== -1) return 1

    return byUpdatedAtDesc(threadsByLabel[a][0], threadsByLabel[b][0])
  }

// --- Public API ---

export function getGroupLabel(dateStr) {
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

export function groupThreadsWithFolders(threads) {
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
