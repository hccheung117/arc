/**
 * Encapsulated per-session composer state.
 *
 * A module-private Zustand store owns mode, overrides, and drafts keyed by
 * session ID — nothing is exported except the two public surfaces below.
 * This keeps write-side coordination (value derivation, submit protocols,
 * mode transitions) inside one module instead of scattered across the app
 * store and MODES config.
 *
 * Public API:
 *   useComposer()    — React hook returning { mode, config, value, updateDraft, submit, setMode }
 *   useComposerMode()— lightweight mode-only selector (avoids re-render on draft changes)
 *   composerActions  — imperative { setMode, setDraftText } for IPC handlers outside React
 */
import { create } from "zustand"
import { resolveMode, textFromParts } from "@/lib/composer-modes"
import { useAppStore, act } from "@/store/app-store"
import { useSession } from "@/contexts/SessionContext"
import { useSubscription } from "@/hooks/use-subscription"

// --- private store -----------------------------------------------------------

const DEFAULT_SESSION = { mode: "chat", overrides: {}, drafts: {} }

const _composerStore = create(() => ({ sessions: {} }))

const _put = (sid, fn) =>
  _composerStore.setState((s) => ({
    sessions: { ...s.sessions, [sid]: fn(s.sessions[sid] ?? DEFAULT_SESSION) },
  }))

// --- imperative actions (usable outside React) -------------------------------

export const composerActions = {
  setMode: (sid, mode, overrides = {}) =>
    _put(sid, (s) => ({ ...s, mode, overrides })),

  setDraftText: (sid, mode, value) =>
    _put(sid, (s) => ({ ...s, drafts: { ...s.drafts, [mode]: { ...(s.drafts[mode] ?? {}), text: value } } })),

  setDraftFiles: (sid, mode, updaterOrValue) =>
    _put(sid, (s) => {
      const current = s.drafts[mode]?.files ?? []
      const files = typeof updaterOrValue === 'function' ? updaterOrValue(current) : updaterOrValue
      return { ...s, drafts: { ...s.drafts, [mode]: { ...(s.drafts[mode] ?? {}), files } } }
    }),
}

// --- value derivation --------------------------------------------------------

const deriveValue = (mode, overrides, drafts, prompt, messages) => {
  if (mode === "prompt") return drafts[mode]?.text || prompt || ""
  if (mode.startsWith("edit:")) {
    return drafts[mode]?.text ?? textFromParts(messages?.find((m) => m.id === overrides.messageKey)) ?? ""
  }
  return drafts[mode]?.text ?? ""
}

// --- submit protocols --------------------------------------------------------

const submitChat = (sid, value, files, attachments, sendMessage, promptRef, providerId, modelId) => {
  sendMessage({ text: value, files }, { body: { promptRef, providerId, modelId, attachments } })
  composerActions.setDraftText(sid, "chat", "")
  composerActions.setDraftFiles(sid, "chat", [])
  act().session.commitDraft()
}

const submitEditUser = (sid, value, files, attachments, messages, messageKey, sendMessage, setMessages, promptRef, providerId, modelId) => {
  const idx = messages.findIndex((m) => m.id === messageKey)
  if (idx === -1) return
  setMessages(messages.slice(0, idx))
  sendMessage({ text: value, files }, { body: { promptRef, providerId, modelId, attachments } })
  composerActions.setDraftText(sid, "edit:user", "")
  composerActions.setDraftFiles(sid, "edit:user", [])
  composerActions.setMode(sid, "chat")
}

const submitEditAi = (sid, value, messageKey) => {
  window.api.call("message:edit-save", { sessionId: sid, messageId: messageKey, text: value })
  composerActions.setDraftText(sid, "edit:ai", "")
  composerActions.setMode(sid, "chat")
}

const submitPrompt = (sid, value) => {
  window.api.call("session:save-prompt", { id: sid, content: value })
  composerActions.setDraftText(sid, "prompt", "")
  composerActions.setMode(sid, "chat")
}

// --- public hook -------------------------------------------------------------

export const useComposerMode = () => {
  const sid = useAppStore((s) => s.activeSessionId)
  return _composerStore((s) => s.sessions[sid]?.mode ?? "chat")
}

export const useComposer = () => {
  const sid = useAppStore((s) => s.activeSessionId)
  const promptRef = useAppStore((s) => s.workbenches[s.activeSessionId]?.promptRef)
  const wbProviderId = useAppStore((s) => s.workbenches[s.activeSessionId]?.providerId)
  const wbModelId = useAppStore((s) => s.workbenches[s.activeSessionId]?.modelId)
  const state = useSubscription('state:listen', {})
  const providerId = wbProviderId ?? state.lastUsedProvider
  const modelId = wbModelId ?? state.lastUsedModel
  const { sendMessage, setMessages, prompt, messages } = useSession()

  const { mode, overrides, drafts } = _composerStore(
    (s) => s.sessions[sid] ?? DEFAULT_SESSION,
  )

  const config = resolveMode(mode, overrides)
  const value = deriveValue(mode, overrides, drafts, prompt, messages)
  const attachments = drafts[mode]?.files ?? []

  return {
    mode,
    config,
    value,
    attachments,
    setAttachments: (updater) => composerActions.setDraftFiles(sid, mode, updater),
    updateDraft: (val) => composerActions.setDraftText(sid, mode, val),
    setMode: (m, ov) => composerActions.setMode(sid, m, ov),
    submit: (text, files, attachments) => {
      if (mode === "prompt") return submitPrompt(sid, text)
      if (mode === "chat") return submitChat(sid, text, files, attachments, sendMessage, promptRef, providerId, modelId)
      if (mode === "edit:user") return submitEditUser(sid, text, files, attachments, messages, overrides.messageKey, sendMessage, setMessages, promptRef, providerId, modelId)
      if (mode === "edit:ai") return submitEditAi(sid, text, overrides.messageKey)
    },
  }
}
