import { createContext, use, useCallback, useEffect, useMemo, useState } from "react"
import { Chat, useChat } from "@ai-sdk/react"
import { IpcTransport } from "@/lib/ipc-session-transport"
import { useAppStore } from "@/store/app-store"
import { useSubscription } from "@/hooks/use-subscription"

const SessionContext = createContext()

export const useSession = () => use(SessionContext)

const chatInstances = new Map()

export function SessionProvider({ children }) {
  const transport = useMemo(() => new IpcTransport(), [])
  const activeSessionId = useAppStore((s) => s.activeSessionId)

  if (!chatInstances.has(activeSessionId)) {
    chatInstances.set(activeSessionId, new Chat({ id: activeSessionId, transport }))
  }

  const chat = useChat({ chat: chatInstances.get(activeSessionId) })
  const [prompt, setPrompt] = useState(null)
  const [branches, setBranches] = useState({})
  const promptRef = useAppStore((s) => s.workbenches[s.activeSessionId]?.promptRef)
  const profilePrompts = useSubscription('prompt:listen', [])

  useEffect(() => window.api.on('session:state:listen', (payload) => {
    if (payload.sessionId !== activeSessionId) return
    if (payload.messages) chat.setMessages(payload.messages)
    if (payload.branches) setBranches(payload.branches)
    if ('prompt' in payload) setPrompt(payload.prompt)
  }), [activeSessionId])

  useEffect(() => {
    const { draftSessionId } = useAppStore.getState()
    if (activeSessionId === draftSessionId) {
      chat.setMessages([])
      setBranches({})
      setPrompt(promptRef
        ? profilePrompts.find(p => p.name === promptRef)?.content ?? null
        : null
      )
      return
    }
    window.api.call('session:activate', { sessionId: activeSessionId })
  }, [activeSessionId, promptRef, profilePrompts])

  const switchBranch = useCallback((targetId) => {
    window.api.call('message:switch-branch', { sessionId: activeSessionId, targetId })
  }, [activeSessionId])

  return (
    <SessionContext value={{ ...chat, prompt, branches, switchBranch }}>
      {children}
    </SessionContext>
  )
}
