import type { ThreadSummary } from '@arc-types/threads'
import type { Thread, ThreadPatch, ThreadEvent, Unsubscribe } from '@arc-types/arc-api'

export async function getThreadSummaries(): Promise<ThreadSummary[]> {
  return window.arc.threads.list()
}

export async function updateThread(id: string, patch: ThreadPatch): Promise<Thread> {
  return window.arc.threads.update(id, patch)
}

export async function deleteThread(threadId: string): Promise<void> {
  return window.arc.threads.delete(threadId)
}

export async function renameThread(threadId: string, title: string): Promise<void> {
  await window.arc.threads.update(threadId, { title })
}

export function onThreadEvent(callback: (event: ThreadEvent) => void): Unsubscribe {
  return window.arc.threads.onEvent(callback)
}

/**
 * Shows thread context menu. Data actions (delete, togglePin) are handled in main.
 * Returns 'rename' for UI-only action, or null otherwise.
 */
export async function showThreadContextMenu(
  threadId: string,
  isPinned: boolean
): Promise<'rename' | null> {
  return window.arc.ui.showThreadContextMenu(threadId, isPinned)
}
