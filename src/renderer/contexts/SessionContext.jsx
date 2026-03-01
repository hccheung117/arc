import { createContext, use, useCallback, useEffect, useMemo, useState } from "react"
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
  const [branches, setBranches] = useState({})
  const promptRef = useAppStore((s) => s.workbenches[s.activeSessionId]?.promptRef)
  const profilePrompts = useSubscription('prompt:listen', [])

  useEffect(() => {
    if (activeSessionId === draftSessionId) {
      chat.setMessages([])
      setBranches({})
      setPrompt(promptRef
        ? profilePrompts.find(p => p.name === promptRef)?.content ?? null
        : null
      )
      return
    }
    window.api.call('session:load', { sessionId: activeSessionId })
      .then(({ messages, branches, prompt }) => {
        chat.setMessages(messages)
        setBranches(branches)
        setPrompt(prompt)
      })
  }, [activeSessionId, draftSessionId, promptRef, profilePrompts])

  const switchBranch = useCallback(async (targetId) => {
    const result = await window.api.call('message:switch-branch', {
      sessionId: activeSessionId, targetId,
    })
    chat.setMessages(result.messages)
    setBranches(result.branches)
  }, [activeSessionId, chat])

  return (
    <SessionContext value={{ ...chat, prompt, branches, switchBranch }}>
      {children}
    </SessionContext>
  )
}
