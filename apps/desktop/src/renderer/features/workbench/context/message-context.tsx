import { createContext, useContext } from 'react'
import type { MessageRole } from '@renderer/lib/messages'

/**
 * Message-level ambient context
 *
 * Provides messageId and role to all children of a message component.
 * Used by leaf components (MessageActions, MessageFooter) that need
 * to identify which message they're operating on.
 */

interface MessageContextValue {
  messageId: string
  role: MessageRole
}

const MessageContext = createContext<MessageContextValue | null>(null)

interface MessageProviderProps {
  messageId: string
  role: MessageRole
  children: React.ReactNode
}

export function MessageProvider({ messageId, role, children }: MessageProviderProps) {
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
