import { createContext, use, useEffect, useMemo } from "react"
import { useChat } from "@ai-sdk/react"
import { IpcSessionTransport } from "@/lib/ipc-session-transport"

const SessionContext = createContext()

export const useSession = () => use(SessionContext)

export function SessionProvider({ sessionId, children }) {
  const transport = useMemo(() => new IpcSessionTransport(), [])
  const chat = useChat({ id: sessionId, transport })

  useEffect(() => {
    if (!sessionId) {
      chat.setMessages([])
      return
    }
    window.api.call('session:load', { sessionId }).then(chat.setMessages)
  }, [sessionId])

  return (
    <SessionContext value={chat}>
      {children}
    </SessionContext>
  )
}
