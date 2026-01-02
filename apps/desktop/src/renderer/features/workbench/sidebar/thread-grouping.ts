import type { ChatThread } from '@renderer/features/workbench/chat/domain/thread'

export interface GroupedThreads {
  pinned: ChatThread[]
  groups: Array<{
    label: string
    threads: ChatThread[]
  }>
}

const GROUP_ORDER = ['Today', 'Yesterday', 'Previous 7 Days', 'Previous 30 Days'] as const

/**
 * Calculates the appropriate group label for a given date
 */
export function getGroupLabel(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffTime = today.getTime() - target.getTime()
  const diffDays = diffTime / (1000 * 60 * 60 * 24)

  if (diffDays < 1) return 'Today'
  if (diffDays < 2) return 'Yesterday'
  if (diffDays <= 7) return 'Previous 7 Days'
  if (diffDays <= 30) return 'Previous 30 Days'

  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('en-US', { month: 'long' })
  }

  return date.getFullYear().toString()
}

/**
 * Sorts group labels by their temporal order
 * Known labels (Today, Yesterday, etc.) come first in order,
 * followed by months/years sorted by recency
 */
function sortGroupLabels(
  labels: string[],
  threadsByLabel: Record<string, ChatThread[]>,
): string[] {
  return labels.sort((a, b) => {
    const indexA = GROUP_ORDER.indexOf(a as (typeof GROUP_ORDER)[number])
    const indexB = GROUP_ORDER.indexOf(b as (typeof GROUP_ORDER)[number])

    if (indexA !== -1 && indexB !== -1) return indexA - indexB
    if (indexA !== -1) return -1
    if (indexB !== -1) return 1

    // For months/years, sort by most recent thread in each group
    const dateA = new Date(threadsByLabel[a][0].updatedAt).getTime()
    const dateB = new Date(threadsByLabel[b][0].updatedAt).getTime()
    return dateB - dateA
  })
}

/**
 * Groups threads by date and separates pinned threads
 *
 * @returns Pinned threads separately, plus groups sorted by recency
 */
export function groupThreadsByDate(threads: ChatThread[]): GroupedThreads {
  // Filter out draft threads that haven't been started yet
  const validThreads = threads.filter((thread) => thread.status !== 'draft')

  const pinned = validThreads.filter((t) => t.isPinned)
  const unpinned = validThreads.filter((t) => !t.isPinned)

  // Group unpinned threads by date label
  const threadsByLabel = unpinned.reduce(
    (acc, thread) => {
      const label = getGroupLabel(thread.updatedAt)
      if (!acc[label]) acc[label] = []
      acc[label].push(thread)
      return acc
    },
    {} as Record<string, ChatThread[]>,
  )

  // Sort threads within each group by updatedAt desc
  Object.values(threadsByLabel).forEach((groupThreads) => {
    groupThreads.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  })

  // Build sorted groups array
  const sortedLabels = sortGroupLabels(Object.keys(threadsByLabel), threadsByLabel)
  const groups = sortedLabels.map((label) => ({
    label,
    threads: threadsByLabel[label],
  }))

  return { pinned, groups }
}
