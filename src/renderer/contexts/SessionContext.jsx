import { createContext, use, useEffect, useMemo } from "react"
import { useChat } from "@ai-sdk/react"
import { IpcTransport } from "@/lib/ipc-session-transport"
import { useAppStore } from "@/store/app-store"

const SessionContext = createContext()

export const useSession = () => use(SessionContext)

export function SessionProvider({ children }) {
  const transport = useMemo(() => new IpcTransport(), [])
  const activeSessionId = useAppStore((s) => s.activeSessionId)
  const draftSessionId = useAppStore((s) => s.draftSessionId)
  const chat = useChat({ id: activeSessionId, transport })

  useEffect(() => {
    if (activeSessionId === draftSessionId) {
      chat.setMessages([])
      return
    }
    window.api.call('session:load', { sessionId: activeSessionId }).then(chat.setMessages)
  }, [activeSessionId, draftSessionId])

  return (
    <SessionContext value={chat}>
      {children}
    </SessionContext>
  )
}
