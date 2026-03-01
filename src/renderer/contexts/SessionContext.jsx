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

    const skipMessages = chat.messages.length > 0 || chat.status !== 'ready'

    window.api.call('session:load', { sessionId: activeSessionId })
      .then(({ messages, branches, prompt }) => {
        if (!skipMessages) chat.setMessages(messages)
        setBranches(branches)
        setPrompt(prompt)
      })
  }, [activeSessionId, promptRef, profilePrompts])

  useEffect(() => window.api.on('session:branches', ({ sessionId, branches }) => {
    if (sessionId === activeSessionId) setBranches(branches)
  }), [activeSessionId])

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
