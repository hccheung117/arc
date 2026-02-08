import { createContext, useContext } from 'react'

/**
 * Thread-level ambient context
 *
 * Provides threadId to all children without prop drilling.
 * Used by leaf components (MessageActions) and hooks (useStreamingStore, useEditingStore)
 * that need to identify which thread they're operating on.
 */

const ThreadContext = createContext(null)

export function ThreadProvider({ threadId, children }) {
  return <ThreadContext.Provider value={{ threadId }}>{children}</ThreadContext.Provider>
}

/**
 * Access thread context - throws if used outside ThreadProvider
 */
export function useThreadContext() {
  const ctx = useContext(ThreadContext)
  if (!ctx) {
    throw new Error('useThreadContext must be used within ThreadProvider')
  }
  return ctx
}

/**
 * Convenience hook for the most common use case
 */
export function useThreadId() {
  return useThreadContext().threadId
}
