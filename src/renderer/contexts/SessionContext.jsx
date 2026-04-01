import { createContext, use, useCallback, useEffect, useReducer } from 'react'
import { generateId } from 'ai'
import { useAppStore, act } from '@/store/app-store'
import { useSubscription } from '@/hooks/use-subscription'

const SessionContext = createContext()

export const useSession = () => use(SessionContext)

const initialState = {
  messages: [],
  branches: {},
  prompt: null,
  status: 'ready',
  error: null,
}

const reducer = (state, event) => {
  switch (event.type) {
    case 'snapshot':
      return {
        messages: event.messages ?? state.messages,
        branches: event.branches ?? state.branches,
        prompt: 'prompt' in event ? event.prompt : state.prompt,
        status: event.status ?? state.status,
        error: event.error ?? null,
      }
    case 'tip': {
      if (!event.message) return state
      const msgs = state.messages
      const last = msgs.at(-1)
      if (last?.role === 'assistant') {
        const updated = msgs.slice(0, -1)
        updated.push(event.message)
        return { ...state, messages: updated }
      }
      return { ...state, messages: [...msgs, event.message] }
    }
    case 'status':
      return { ...state, status: event.status, error: event.error ?? null }
    case 'reset':
      return { ...initialState, prompt: event.prompt ?? null }
    default:
      return state
  }
}

export function SessionProvider({ children, popoutSessionId }) {
  const storeSessionId = useAppStore((s) => s.activeSessionId)
  const activeSessionId = popoutSessionId ?? storeSessionId
  const [state, dispatch] = useReducer(reducer, initialState)
  const promptRef = useAppStore((s) => s.workbenches[s.activeSessionId]?.promptRef)
  const profilePrompts = useSubscription('prompt:feed', [])

  useEffect(() => window.api.on('session:navigate:feed', (id) => {
    act().session.activate(id)
  }), [])

  useEffect(() => window.api.on('session:state:feed', (event) => {
    if (event.sessionId !== activeSessionId) return

    // Auto-detect provider/model from last assistant message on snapshot
    if (event.type === 'snapshot' && event.messages) {
      const lastAssistant = event.messages.findLast(m => m.role === 'assistant')
      const wb = useAppStore.getState().workbenches[activeSessionId]
      if (lastAssistant?.arcModelId && !wb?.modelId) {
        act().workbench.update({
          providerId: lastAssistant.arcProviderId,
          modelId: lastAssistant.arcModelId,
        })
      }
    }

    dispatch(event)
  }), [activeSessionId])

  useEffect(() => {
    const { draftSessionId } = useAppStore.getState()
    if (activeSessionId === draftSessionId) {
      dispatch({
        type: 'reset',
        prompt: promptRef
          ? profilePrompts.find(p => p.name === promptRef)?.content ?? null
          : null,
      })
      return
    }
    window.api.call('session:activate', { sessionId: activeSessionId })
  }, [activeSessionId, promptRef, profilePrompts])

  const switchBranch = useCallback((targetId) => {
    if (state.status === 'streaming') return
    window.api.call('message:switch-branch', { sessionId: activeSessionId, targetId })
  }, [activeSessionId, state.status])

  const sendMessage = useCallback(async ({ text, parts: userParts }, { body } = {}) => {
    const parts = userParts ?? [{ type: 'text', text }]
    const userMessage = { id: generateId(), role: 'user', parts }
    const history = body?.messages ?? state.messages
    try {
      const result = await window.api.call('session:send', {
        sessionId: activeSessionId,
        messages: [...history, userMessage],
        promptRef: body?.promptRef,
        providerId: body?.providerId,
        modelId: body?.modelId,
      })
      if (result?.error) {
        dispatch({ type: 'status', sessionId: activeSessionId, status: 'ready', error: result.error })
      }
    } catch (e) {
      dispatch({ type: 'status', sessionId: activeSessionId, status: 'ready', error: e.message ?? 'Send failed' })
    }
  }, [activeSessionId, state.messages])

  const stop = useCallback(() => {
    window.api.call('session:abort', { sessionId: activeSessionId })
  }, [activeSessionId])

  return (
    <SessionContext value={{
      messages: state.messages,
      status: state.status,
      error: state.error,
      id: activeSessionId,
      branches: state.branches,
      prompt: state.prompt,
      switchBranch,
      sendMessage,
      stop,
    }}>
      {children}
    </SessionContext>
  )
}
