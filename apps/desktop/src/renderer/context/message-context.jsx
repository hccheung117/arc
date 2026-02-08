import { createContext, useContext } from 'react'

/**
 * Message-level ambient context
 *
 * Provides messageId and role to all children of a message component.
 * Used by leaf components (MessageActions, MessageFooter) that need
 * to identify which message they're operating on.
 */

const MessageContext = createContext(null)

export function MessageProvider({ messageId, role, children }) {
  return <MessageContext.Provider value={{ messageId, role }}>{children}</MessageContext.Provider>
}

/**
 * Access message context - throws if used outside MessageProvider
 */
export function useMessageContext() {
  const ctx = useContext(MessageContext)
  if (!ctx) {
    throw new Error('useMessageContext must be used within MessageProvider')
  }
  return ctx
}

/**
 * Convenience hook for messageId
 */
export function useMessageId() {
  return useMessageContext().messageId
}
