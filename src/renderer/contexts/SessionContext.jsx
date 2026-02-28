import { createContext, use, useEffect, useMemo, useState } from "react"
import { useChat } from "@ai-sdk/react"
import { IpcTransport } from "@/lib/ipc-session-transport"
import { useAppStore } from "@/store/app-store"
import { useSubscription } from "@/hooks/use-subscription"

const SessionContext = createContext()

export const useSession = () => use(SessionContext)

export function SessionProvider({ children }) {
  const transport = useMemo(() => new IpcTransport(), [])
  const activeSessionId = useAppStore((s) => s.activeSessionId)
  const draftSessionId = useAppStore((s) => s.draftSessionId)
  const chat = useChat({ id: activeSessionId, transport })
  const [prompt, setPrompt] = useState(null)
  const promptRef = useAppStore((s) => s.workbenches[s.activeSessionId]?.promptRef)
  const profilePrompts = useSubscription('prompt:listen', [])

  useEffect(() => {
    if (activeSessionId === draftSessionId) {
      chat.setMessages([])
      setPrompt(promptRef
        ? profilePrompts.find(p => p.name === promptRef)?.content ?? null
        : null
      )
      return
    }
    window.api.call('session:load', { sessionId: activeSessionId })
      .then(({ messages, prompt }) => {
        chat.setMessages(messages)
        setPrompt(prompt)
      })
  }, [activeSessionId, draftSessionId, promptRef, profilePrompts])

  return (
    <SessionContext value={{ ...chat, prompt }}>
      {children}
    </SessionContext>
  )
}
