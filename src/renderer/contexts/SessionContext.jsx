import { createContext, use, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Chat, useChat } from "@ai-sdk/react"
import { IpcTransport } from "@/lib/ipc-session-transport"
import { isLLMBusy } from '@/hooks/use-llm-lock'
import { useAppStore, act } from "@/store/app-store"
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
  const chatRef = useRef(chat)
  chatRef.current = chat
  const [prompt, setPrompt] = useState(null)
  const [branches, setBranches] = useState({})
  const promptRef = useAppStore((s) => s.workbenches[s.activeSessionId]?.promptRef)
  const profilePrompts = useSubscription('prompt:feed', [])

  useEffect(() => window.api.on('session:navigate:feed', (id) => {
    act().session.activate(id)
  }), [])

  useEffect(() => window.api.on('session:state:feed', (payload) => {
    if (payload.sessionId !== activeSessionId) return
    if (payload.replaceFiles) {
      const { id, parts, textParts } = payload.replaceFiles
      const c = chatRef.current
      c.setMessages(c.messages.map(m =>
        m.id === id ? { ...m, parts: [
          ...parts,
          ...(textParts ?? m.parts.filter(p => p.type === 'text')),
          ...m.parts.filter(p => p.type !== 'file' && p.type !== 'text'),
        ] } : m
      ))
    }
    if (payload.messages) {
      chat.setMessages(payload.messages)
      const lastAssistant = payload.messages.findLast(m => m.role === 'assistant')
      const wb = useAppStore.getState().workbenches[activeSessionId]
      if (lastAssistant?.arcModelId && !wb?.modelId) {
        act().workbench.update({
          providerId: lastAssistant.arcProviderId,
          modelId: lastAssistant.arcModelId,
        })
      }
    }
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
    if (isLLMBusy(chatRef.current.status)) return
    window.api.call('message:switch-branch', { sessionId: activeSessionId, targetId })
  }, [activeSessionId])

  return (
    <SessionContext value={{ ...chat, prompt, branches, switchBranch }}>
      {children}
    </SessionContext>
  )
}
