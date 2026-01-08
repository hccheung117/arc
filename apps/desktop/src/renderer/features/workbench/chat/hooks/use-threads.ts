import { useReducer, useEffect, useRef } from 'react'
import {
  type ChatThread,
  type ThreadAction,
  hydrateFromSummary,
  getThreadSummaries,
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

/**
 * Finds a thread by ID anywhere in the tree.
 */
const findInTree = (threads: ChatThread[], id: string): ChatThread | undefined => {
  for (const t of threads) {
    if (t.id === id) return t
    const found = findInTree(t.children, id)
    if (found) return found
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Reducer
// ─────────────────────────────────────────────────────────────────────────────

function threadsReducer(state: ChatThread[], action: ThreadAction): ChatThread[] {
  switch (action.type) {
    case 'HYDRATE': {
      const hydrated = action.threads.map(hydrateFromSummary)
      const drafts = state.filter((t) => t.status === 'draft')
      return [...drafts, ...hydrated]
    }

    case 'UPSERT':
      return existsInTree(state, action.thread.id)
        ? modifyTree(state, action.thread.id, () => action.thread)
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
  const threadsRef = useRef(threads)
  threadsRef.current = threads

  // Hydrate threads from database on mount
  useEffect(() => {
    getThreadSummaries().then((threads) => dispatch({ type: 'HYDRATE', threads }))
  }, [])

  // Subscribe to thread events for sidebar reactivity
  useEffect(() => {
    return onThreadEvent((event) => {
      if (event.type === 'deleted') {
        dispatch({ type: 'DELETE', id: event.id })
        clearBranchSelections(event.id)
      } else {
        const thread = hydrateFromSummary(event.thread)
        dispatch({ type: 'UPSERT', thread })

        // Auto-delete folders that became empty
        if (event.type === 'updated' && thread.children.length === 0) {
          const prev = findInTree(threadsRef.current, thread.id)
          if (prev && prev.children.length > 0) {
            window.arc.threads.delete(thread.id)
          }
        }
      }
    })
  }, [])

  return { threads, dispatch }
}