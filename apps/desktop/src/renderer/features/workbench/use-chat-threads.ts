import { useReducer, useEffect } from 'react'
import type { Message } from '@arc-types/messages'
import type { ConversationSummary } from '@arc-types/conversations'
import { getConversationSummaries } from '@renderer/lib/conversations'
import { type ChatThread, createDraftThread, hydrateFromConversation } from './chat-thread'

/**
 * Actions for managing ChatThread state
 */
export type ThreadAction =
  | { type: 'CREATE_DRAFT'; id?: string }
  | { type: 'HYDRATE'; conversations: ConversationSummary[] }
  | { type: 'ADD_MESSAGE'; id: string; message: Message }
  | { type: 'UPDATE_MESSAGES'; id: string; messages: Message[] }
  | { type: 'UPDATE_STATUS'; id: string; status: ChatThread['status'] }
  | { type: 'UPDATE_TITLE'; id: string; title: string }
  | { type: 'DELETE_THREAD'; id: string }
  | { type: 'RENAME_THREAD'; id: string; title: string }
  | { type: 'TOGGLE_PIN'; id: string; isPinned: boolean }

/**
 * Reducer for ChatThread state management
 */
function threadsReducer(state: ChatThread[], action: ThreadAction): ChatThread[] {
  switch (action.type) {
    case 'CREATE_DRAFT': {
      const newThread = action.id
        ? { ...createDraftThread(), id: action.id }
        : createDraftThread()
      return [newThread, ...state]
    }

    case 'HYDRATE': {
      // Convert database conversations to UI threads
      const hydratedThreads = action.conversations.map(hydrateFromConversation)
      return hydratedThreads
    }

    case 'ADD_MESSAGE': {
      return state.map((thread) => {
        if (thread.id === action.id) {
          return {
            ...thread,
            messages: [...thread.messages, action.message],
          }
        }
        return thread
      })
    }

    case 'UPDATE_MESSAGES': {
      return state.map((thread) => {
        if (thread.id === action.id) {
          return {
            ...thread,
            messages: action.messages,
          }
        }
        return thread
      })
    }

    case 'UPDATE_STATUS': {
      return state.map((thread) => {
        if (thread.id === action.id) {
          return {
            ...thread,
            status: action.status,
          }
        }
        return thread
      })
    }

    case 'UPDATE_TITLE': {
      return state.map((thread) => {
        if (thread.id === action.id) {
          return {
            ...thread,
            title: action.title,
          }
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
          return {
            ...thread,
            title: action.title,
          }
        }
        return thread
      })
    }

    case 'TOGGLE_PIN': {
      return state.map((thread) => {
        if (thread.id === action.id) {
          return {
            ...thread,
            isPinned: action.isPinned,
          }
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
 * - Maintain thread state throughout component lifecycle
 *
 * Usage:
 * ```typescript
 * const { threads, dispatch } = useChatThreads()
 *
 * // Create new draft thread
 * dispatch({ type: 'CREATE_DRAFT' })
 *
 * // Add message to thread
 * dispatch({ type: 'ADD_MESSAGE', id, message })
 * ```
 */
export function useChatThreads() {
  const [threads, dispatch] = useReducer(threadsReducer, [])

  // Hydrate threads from database on mount
  useEffect(() => {
    getConversationSummaries().then((conversations) => {
      dispatch({ type: 'HYDRATE', conversations })
    })
  }, [])

  return { threads, dispatch }
}
