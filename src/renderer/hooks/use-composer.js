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
 *   composerActions  — imperative { setMode, setDraft } for IPC handlers outside React
 */
import { create } from "zustand"
import { resolveMode, textFromParts } from "@/lib/composer-modes"
import { useAppStore, act } from "@/store/app-store"
import { useSession } from "@/contexts/SessionContext"

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

  setDraft: (sid, mode, value) =>
    _put(sid, (s) => ({ ...s, drafts: { ...s.drafts, [mode]: value } })),
}

// --- value derivation --------------------------------------------------------

const deriveValue = (mode, overrides, drafts, prompt, messages) => {
  if (mode === "prompt") return drafts[mode] || prompt || ""
  if (mode.startsWith("edit:")) {
    return drafts[mode] ?? textFromParts(messages?.find((m) => m.id === overrides.messageKey)) ?? ""
  }
  return drafts[mode] ?? ""
}

// --- submit protocols --------------------------------------------------------

const submitChat = (sid, value, sendMessage, promptRef) => {
  sendMessage({ text: value }, { body: { promptRef } })
  composerActions.setDraft(sid, "chat", "")
  act().session.commitDraft()
}

const submitEdit = (sid, mode, value, sendMessage, promptRef) => {
  sendMessage({ text: value }, { body: { promptRef } })
  composerActions.setDraft(sid, mode, "")
  act().session.commitDraft()
}

const submitPrompt = (sid, value) => {
  window.api.call("session:save-prompt", { id: sid, content: value })
  composerActions.setDraft(sid, "prompt", "")
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
  const { sendMessage, prompt, messages } = useSession()

  const { mode, overrides, drafts } = _composerStore(
    (s) => s.sessions[sid] ?? DEFAULT_SESSION,
  )

  const config = resolveMode(mode, overrides)
  const value = deriveValue(mode, overrides, drafts, prompt, messages)

  return {
    mode,
    config,
    value,
    updateDraft: (val) => composerActions.setDraft(sid, mode, val),
    setMode: (m, ov) => composerActions.setMode(sid, m, ov),
    submit: (text) => {
      if (mode === "prompt") return submitPrompt(sid, text)
      if (mode === "chat") return submitChat(sid, text, sendMessage, promptRef)
      submitEdit(sid, mode, text, sendMessage, promptRef)
    },
  }
}
