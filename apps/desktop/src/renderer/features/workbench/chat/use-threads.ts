import { useReducer, useEffect } from 'react'
import type { ThreadSummary } from '@arc-types/threads'
import { getThreadSummaries, onThreadEvent } from '@renderer/lib/threads'
import { clearBranchSelections } from '@renderer/lib/ui-state-db'
import { type ChatThread, createDraftThread, hydrateFromSummary } from './thread'

/**
 * Actions for managing ChatThread state
 *
 * Note: Message-level state (ADD_MESSAGE, UPDATE_MESSAGES, EDIT_AND_TRUNCATE)
 * is now managed by use-message-tree.ts at the view level, not the global thread list.
 */
export type ThreadAction =
  | { type: 'CREATE_DRAFT'; id?: string }
  | { type: 'HYDRATE'; threads: ThreadSummary[] }
  | { type: 'UPDATE_STATUS'; id: string; status: ChatThread['status'] }
  | { type: 'UPDATE_THREAD_METADATA'; id: string; title: string; updatedAt: string }
  | { type: 'DELETE_THREAD'; id: string }
  | { type: 'RENAME_THREAD'; id: string; title: string }

function threadsReducer(state: ChatThread[], action: ThreadAction): ChatThread[] {
  switch (action.type) {
    case 'CREATE_DRAFT': {
      const newThread = action.id ? { ...createDraftThread(), id: action.id } : createDraftThread()
      return [newThread, ...state]
    }

    case 'HYDRATE': {
      const hydratedThreads = action.threads.map(hydrateFromSummary)
      // Preserve existing draft threads (not yet persisted to database)
      const existingDrafts = state.filter((t) => t.status === 'draft')
      return [...existingDrafts, ...hydratedThreads]
    }

    case 'UPDATE_STATUS': {
      return state.map((thread) => {
        if (thread.id === action.id) {
          return { ...thread, status: action.status }
        }
        return thread
      })
    }

    case 'UPDATE_THREAD_METADATA': {
      return state.map((thread) => {
        if (thread.id === action.id) {
          return { ...thread, title: action.title, updatedAt: action.updatedAt }
        }
        return thread
      })
    }

    case 'DELETE_THREAD': {
      return state.filter((thread) => thread.id !== action.id)
    }

    case 'RENAME_THREAD': {
      return state.map((thread) => {
        if (thread.id === action.id) {
          return { ...thread, title: action.title }
        }
        return thread
      })
    }

    default:
      return state
  }
}

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
    getThreadSummaries().then((threads) => {
      dispatch({ type: 'HYDRATE', threads })
    })
  }, [])

  // Subscribe to thread events for sidebar reactivity
  useEffect(() => {
    const unsubscribe = onThreadEvent((event) => {
      switch (event.type) {
        case 'created':
        case 'updated':
          dispatch({
            type: 'UPDATE_THREAD_METADATA',
            id: event.thread.id,
            title: event.thread.title,
            updatedAt: event.thread.updatedAt,
          })
          break
        case 'deleted':
          dispatch({ type: 'DELETE_THREAD', id: event.id })
          clearBranchSelections(event.id)
          break
      }
    })
    return unsubscribe
  }, [])

  return { threads, dispatch }
}
