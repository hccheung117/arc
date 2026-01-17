import { useReducer, useEffect } from 'react'
import {
  type ChatThread,
  type ThreadAction,
  hydrateThread,
  getThreads,
  onThreadEvent,
} from '@renderer/lib/threads'
import { clearBranchSelections } from '@renderer/lib/ui-state-db'

// ─────────────────────────────────────────────────────────────────────────────
// Tree Operations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generic tree modification. Traverses the tree and applies a modifier
 * to the matching node. Return null from modifier to remove the node.
 */
const modifyTree = (
  threads: ChatThread[],
  id: string,
  modifier: (thread: ChatThread) => ChatThread | null,
): ChatThread[] =>
  threads.flatMap((thread) => {
    if (thread.id === id) {
      const result = modifier(thread)
      return result ? [result] : []
    }
    return thread.children.length > 0
      ? [{ ...thread, children: modifyTree(thread.children, id, modifier) }]
      : [thread]
  })

/**
 * Checks if a thread exists anywhere in the tree.
 */
const existsInTree = (threads: ChatThread[], id: string): boolean =>
  threads.some((t) => t.id === id || existsInTree(t.children, id))

// ─────────────────────────────────────────────────────────────────────────────
// Reducer
// ─────────────────────────────────────────────────────────────────────────────

function threadsReducer(state: ChatThread[], action: ThreadAction): ChatThread[] {
  switch (action.type) {
    case 'HYDRATE': {
      const drafts = state.filter((t) => t.status === 'draft')
      return [...drafts, ...action.threads]
    }

    case 'UPSERT':
      return existsInTree(state, action.thread.id)
        ? modifyTree(state, action.thread.id, (existing) => {
            // If local owns the thread, preserve local config during handoff transition
            if (existing.owner === 'local') {
              return {
                ...action.thread,
                owner: 'local', // Keep local ownership until explicitly transferred
                promptSource: existing.promptSource, // Preserve local prompt config
              }
            }
            // DB owns it, accept backend values
            return action.thread
          })
        : [action.thread, ...state]

    case 'PATCH':
      return modifyTree(state, action.id, (t) => ({ ...t, ...action.patch }))

    case 'DELETE':
      return modifyTree(state, action.id, () => null)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hook for managing ChatThread state
 *
 * Responsibilities:
 * - Hydrate threads from database on mount
 * - Provide reducer dispatch for thread operations
 * - Subscribe to thread events for sidebar reactivity
 */
export function useChatThreads() {
  const [threads, dispatch] = useReducer(threadsReducer, [])

  // Hydrate threads from database on mount
  useEffect(() => {
    getThreads().then((threads) => dispatch({ type: 'HYDRATE', threads }))
  }, [])

  // Subscribe to thread events for sidebar reactivity
  // Auto-delete of empty folders is handled in the domain layer (lib/messages/commands.ts)
  useEffect(() => {
    return onThreadEvent((event) => {
      if (event.type === 'deleted') {
        dispatch({ type: 'DELETE', id: event.id })
        clearBranchSelections(event.id)
      } else {
        const thread = hydrateThread(event.thread)
        dispatch({ type: 'UPSERT', thread })
      }
    })
  }, [])

  return { threads, dispatch }
}