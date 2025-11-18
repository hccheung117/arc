import { useReducer, useEffect } from 'react'
import type { Message } from '@arc/contracts/src/messages'
import type { ConversationSummary } from '@arc/contracts/src/conversations'
import { getConversationSummaries } from '@/lib/core/conversations'
import { type ChatThread, createDraftThread, hydrateFromConversation } from './chat-thread'

/**
 * Actions for managing ChatThread state
 */
export type ThreadAction =
  | { type: 'CREATE_DRAFT'; threadId?: string }
  | { type: 'HYDRATE'; conversations: ConversationSummary[] }
  | { type: 'ADD_MESSAGE'; threadId: string; message: Message }
  | { type: 'UPDATE_MESSAGES'; threadId: string; messages: Message[] }
  | { type: 'UPDATE_STATUS'; threadId: string; status: ChatThread['status'] }
  | { type: 'SET_CONVERSATION_ID'; threadId: string; conversationId: string }
  | { type: 'UPDATE_TITLE'; threadId: string; title: string }
  | { type: 'DELETE_THREAD'; threadId: string }
  | { type: 'RENAME_THREAD'; threadId: string; title: string }

/**
 * Reducer for ChatThread state management
 */
function threadsReducer(state: ChatThread[], action: ThreadAction): ChatThread[] {
  switch (action.type) {
    case 'CREATE_DRAFT': {
      const newThread = action.threadId
        ? { ...createDraftThread(), threadId: action.threadId }
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
        if (thread.threadId === action.threadId) {
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
        if (thread.threadId === action.threadId) {
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
        if (thread.threadId === action.threadId) {
          return {
            ...thread,
            status: action.status,
          }
        }
        return thread
      })
    }

    case 'SET_CONVERSATION_ID': {
      return state.map((thread) => {
        if (thread.threadId === action.threadId) {
          return {
            ...thread,
            conversationId: action.conversationId,
            status: 'streaming' as const,
          }
        }
        return thread
      })
    }

    case 'UPDATE_TITLE': {
      return state.map((thread) => {
        if (thread.threadId === action.threadId) {
          return {
            ...thread,
            title: action.title,
          }
        }
        return thread
      })
    }

    case 'DELETE_THREAD': {
      return state.filter((thread) => thread.threadId !== action.threadId)
    }

    case 'RENAME_THREAD': {
      return state.map((thread) => {
        if (thread.threadId === action.threadId) {
          return {
            ...thread,
            title: action.title,
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
 * // Set conversationId on first message
 * dispatch({ type: 'SET_CONVERSATION_ID', threadId, conversationId })
 *
 * // Add message to thread
 * dispatch({ type: 'ADD_MESSAGE', threadId, message })
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
