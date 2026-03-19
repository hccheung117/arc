import { create } from 'zustand'
import { resolveMode, textFromParts } from '@/lib/composer-modes'
import { useAppStore, act } from '@/store/app-store'
import { useSession } from '@/contexts/SessionContext'
import { isLLMBusy } from '@/hooks/use-llm-lock'
import { useSubscription } from '@/hooks/use-subscription'

// --- private store ---

const DEFAULT_SESSION = { mode: 'chat', overrides: {}, drafts: {} }
const _composerStore = create(() => ({ sessions: {} }))

const _put = (sid, fn) =>
  _composerStore.setState((s) => ({
    sessions: { ...s.sessions, [sid]: fn(s.sessions[sid] ?? DEFAULT_SESSION) },
  }))

// --- imperative actions ---

export const composerActions = {
  setMode: (sid, mode, overrides = {}) =>
    _put(sid, (s) => ({
      ...s, mode, overrides,
      drafts: {
        ...s.drafts,
        ...(mode.startsWith('edit:') ? { [mode]: '' } : {}),
      },
    })),

  setContent: (sid, mode, text) =>
    _put(sid, (s) => ({
      ...s,
      drafts: { ...s.drafts, [mode]: text },
    })),

  saveDraft: (sid, mode, text) =>
    _put(sid, (s) => ({
      ...s,
      drafts: { ...s.drafts, [mode]: text },
    })),
}

// --- submit protocols ---

const submitChat = (sid, text, sendMessage, promptRef, providerId, modelId) => {
  sendMessage({ text }, { body: { promptRef, providerId, modelId } })
  composerActions.setContent(sid, 'chat', '')
  act().session.commitDraft()
}

const submitEditUser = (sid, text, messages, messageKey, sendMessage, setMessages, promptRef, providerId, modelId) => {
  const idx = messages.findIndex((m) => m.id === messageKey)
  if (idx === -1) return
  setMessages(messages.slice(0, idx))
  sendMessage({ text }, { body: { promptRef, providerId, modelId } })
  composerActions.setContent(sid, 'edit:user', '')
  composerActions.setMode(sid, 'chat')
}

const submitEditAi = (sid, text, messageKey) => {
  window.api.call('message:edit-save', { sessionId: sid, messageId: messageKey, text })
  composerActions.setContent(sid, 'edit:ai', '')
  composerActions.setMode(sid, 'chat')
}

const submitPrompt = (sid, text) => {
  window.api.call('session:save-prompt', { id: sid, content: text })
  composerActions.setContent(sid, 'prompt', '')
  composerActions.setMode(sid, 'chat')
}

// --- public hooks ---

export const useComposerMode = () => {
  const sid = useAppStore((s) => s.activeSessionId)
  return _composerStore((s) => s.sessions[sid]?.mode ?? 'chat')
}

export const useComposer = () => {
  const sid = useAppStore((s) => s.activeSessionId)
  const promptRef = useAppStore((s) => s.workbenches[s.activeSessionId]?.promptRef)
  const wbProviderId = useAppStore((s) => s.workbenches[s.activeSessionId]?.providerId)
  const wbModelId = useAppStore((s) => s.workbenches[s.activeSessionId]?.modelId)
  const state = useSubscription('state:feed', {})
  const providerId = wbProviderId ?? state.lastUsedProvider
  const modelId = wbModelId ?? state.lastUsedModel
  const { sendMessage, setMessages, prompt, messages, status } = useSession()

  const { mode, overrides, drafts } = _composerStore(
    (s) => s.sessions[sid] ?? DEFAULT_SESSION,
  )

  const config = resolveMode(mode, overrides)
  const draft = drafts[mode] ?? ''

  const text = (() => {
    if (mode === 'prompt') return draft || prompt || ''
    if (mode.startsWith('edit:') && draft === '') {
      return textFromParts(messages?.find((m) => m.id === overrides.messageKey)) ?? ''
    }
    return draft
  })()

  return {
    mode,
    config,
    text,
    setContent: (val) => composerActions.setContent(sid, mode, val),
    saveDraft: (val) => composerActions.saveDraft(sid, mode, val),
    setMode: (m, ov) => composerActions.setMode(sid, m, ov),
    submit: (text) => {
      if (mode === 'prompt') return submitPrompt(sid, text)
      if (mode === 'edit:ai') return submitEditAi(sid, text, overrides.messageKey)
      if (isLLMBusy(status)) return
      if (mode === 'chat') return submitChat(sid, text, sendMessage, promptRef, providerId, modelId)
      if (mode === 'edit:user') return submitEditUser(sid, text, messages, overrides.messageKey, sendMessage, setMessages, promptRef, providerId, modelId)
    },
  }
}
