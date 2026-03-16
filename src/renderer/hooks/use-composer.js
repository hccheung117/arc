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
 *   useComposer()    — React hook returning { mode, config, plainText, content, version, pendingMention, setContent, syncContent, submit, setMode }
 *   useComposerMode()— lightweight mode-only selector (avoids re-render on draft changes)
 *   composerActions  — imperative { setMode, setContent, syncContent, insertMention } for IPC handlers outside React
 */
import { useEffect } from "react"
import { create } from "zustand"
import { generateText as tiptapGenerateText } from "@tiptap/core"
import { resolveMode, textFromParts } from "@/lib/composer-modes"
import { createExtensions } from "@/lib/composer-extensions"
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
  // [CMD-CHANNEL] Clears pendingMention for target mode (defensive).
  // [SSOT] activeSkill removed from workbench store — nothing to reset.
  setMode: (sid, mode, overrides = {}) =>
    _put(sid, (s) => {
      const draft = s.drafts[mode] ?? {}
      return {
        ...s, mode, overrides,
        drafts: {
          ...s.drafts,
          [mode]: mode.startsWith('edit:')
            ? { content: undefined, version: 0, files: undefined }
            : { ...draft, pendingMention: null },
        },
      }
    }),

  // [CMD-CHANNEL] Editor's onUpdate — writes JSON and clears pendingMention (the "consume" side).
  // Once the editor applies the pending mention, the next onUpdate → syncContent clears the flag.
  // See pendingMention effect in ComposerEditor.jsx.
  syncContent: (sid, mode, json) =>
    _put(sid, (s) => ({ ...s, drafts: { ...s.drafts, [mode]: { ...(s.drafts[mode] ?? {}), content: json, pendingMention: null } } })),

  // [CMD-CHANNEL] External writers (speech, refine, clear, submit) — bumps version so editor
  // picks it up. Clears pendingMention to prevent stale reinsertion into fresh content.
  setContent: (sid, mode, value) =>
    _put(sid, (s) => ({
      ...s,
      drafts: { ...s.drafts, [mode]: { ...(s.drafts[mode] ?? {}), content: value, version: (s.drafts[mode]?.version ?? 0) + 1, pendingMention: null } },
    })),

  setDraftFiles: (sid, mode, updaterOrValue) =>
    _put(sid, (s) => {
      const current = s.drafts[mode]?.files ?? []
      const files = typeof updaterOrValue === 'function' ? updaterOrValue(current) : updaterOrValue
      return { ...s, drafts: { ...s.drafts, [mode]: { ...(s.drafts[mode] ?? {}), files } } }
    }),

  // [CMD-CHANNEL] One-shot command: sets pendingMention on the target mode's draft.
  // Producer: SkillSelectorButton.jsx. Consumer: pendingMention effect in ComposerEditor.jsx.
  insertMention: (sid, mode, name) =>
    _put(sid, (s) => ({
      ...s,
      drafts: {
        ...s.drafts,
        [mode]: { ...(s.drafts[mode] ?? {}), pendingMention: name },
      },
    })),
}

// --- plain text derivation ---------------------------------------------------

const _extensions = createExtensions('')

const derivePlainText = (mode, overrides, drafts, prompt, messages) => {
  const content = drafts[mode]?.content
  if (mode === "prompt") {
    const text = typeof content === 'string' ? content : content ? tiptapGenerateText(content, _extensions) : ''
    return text || prompt || ""
  }
  if (mode.startsWith("edit:")) {
    if (content == null) return textFromParts(messages?.find((m) => m.id === overrides.messageKey)) ?? ""
    return typeof content === 'string' ? content : tiptapGenerateText(content, _extensions)
  }
  if (!content) return ""
  return typeof content === 'string' ? content : tiptapGenerateText(content, _extensions)
}

// --- submit protocols --------------------------------------------------------

// [DETECT-MAIN] activeSkill is no longer passed from the renderer — main detects it
// from the last user message text (see services/session.js prepareSend).
// [SSOT] No workbench.update({ activeSkill }) — store field removed.
const submitChat = (sid, value, files, attachments, sendMessage, promptRef, providerId, modelId) => {
  sendMessage({ text: value, files }, { body: { promptRef, providerId, modelId, attachments } })
  composerActions.setContent(sid, "chat", "")
  composerActions.setDraftFiles(sid, "chat", [])
  act().session.commitDraft()
}

// [DETECT-MAIN] Same as submitChat — activeSkill removed from params and body.
const submitEditUser = (sid, value, files, attachments, messages, messageKey, sendMessage, setMessages, promptRef, providerId, modelId) => {
  const idx = messages.findIndex((m) => m.id === messageKey)
  if (idx === -1) return
  setMessages(messages.slice(0, idx))
  sendMessage({ text: value, files }, { body: { promptRef, providerId, modelId, attachments } })
  composerActions.setContent(sid, "edit:user", undefined)
  composerActions.setDraftFiles(sid, "edit:user", undefined)
  composerActions.setMode(sid, "chat")
}

const submitEditAi = (sid, value, messageKey) => {
  window.api.call("message:edit-save", { sessionId: sid, messageId: messageKey, text: value })
  composerActions.setContent(sid, "edit:ai", "")
  composerActions.setMode(sid, "chat")
}

const submitPrompt = (sid, value) => {
  window.api.call("session:save-prompt", { id: sid, content: value })
  composerActions.setContent(sid, "prompt", "")
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
  const state = useSubscription('state:feed', {})
  const providerId = wbProviderId ?? state.lastUsedProvider
  const modelId = wbModelId ?? state.lastUsedModel
  const { sendMessage, setMessages, prompt, messages } = useSession()

  const { mode, overrides, drafts } = _composerStore(
    (s) => s.sessions[sid] ?? DEFAULT_SESSION,
  )

  const config = resolveMode(mode, overrides)
  const plainText = derivePlainText(mode, overrides, drafts, prompt, messages)
  const content = drafts[mode]?.content
  const version = drafts[mode]?.version ?? 0
  const attachments = drafts[mode]?.files ?? []
  // [CMD-CHANNEL] Consumed by the pendingMention effect in ComposerEditor.jsx.
  const pendingMention = drafts[mode]?.pendingMention ?? null

  useEffect(() => {
    if (mode !== 'edit:user') return
    if (drafts[mode]?.files !== undefined) return
    const origMsg = messages?.find((m) => m.id === overrides.messageKey)
    if (!origMsg) return
    const fileParts = origMsg.parts
      .filter((p) => p.type === 'file')
      .map((p) => ({ id: p.url, type: 'file', url: p.url, filename: p.filename, mediaType: p.mediaType }))
    if (fileParts.length === 0) return
    composerActions.setDraftFiles(sid, mode, fileParts)
  }, [mode, overrides.messageKey])

  return {
    mode,
    config,
    plainText,
    content,
    version,
    attachments,
    pendingMention,
    setAttachments: (updater) => composerActions.setDraftFiles(sid, mode, updater),
    setContent: (val) => composerActions.setContent(sid, mode, val),
    syncContent: (json) => composerActions.syncContent(sid, mode, json),
    setMode: (m, ov) => composerActions.setMode(sid, m, ov),
    submit: (text, files, attachments) => {
      if (mode === "prompt") return submitPrompt(sid, text)
      if (mode === "chat") return submitChat(sid, text, files, attachments, sendMessage, promptRef, providerId, modelId)
      if (mode === "edit:user") return submitEditUser(sid, text, files, attachments, messages, overrides.messageKey, sendMessage, setMessages, promptRef, providerId, modelId)
      if (mode === "edit:ai") return submitEditAi(sid, text, overrides.messageKey)
    },
  }
}
