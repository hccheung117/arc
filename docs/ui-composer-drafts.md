# UI Pattern: Composer Dual-Format Drafts

## Purpose

The app thinks in plain text, but the Tiptap editor thinks in JSON (ProseMirror document tree). Crossing between these two representations is a potential failure point. Previously, the editor's internal save/restore loop went through a lossy text round-trip (`editor → getText() → store → text prop → setHydratedContent() → editor`), causing issues with linebreaks, mentions, and other custom nodes.

This document defines how the Composer handles dual formats to ensure lossless internal state while preserving a clean plain-text API for external consumers.

---

## Mental Model: Format by Audience

**The editor thinks in JSON, but speaks text.**

- **Cache (Internal):** State that survives mode switches and remounts speaks JSON. This provides a lossless round-trip for the editor.
- **Consumers (External):** Real consumers (submit, promote, refine, IPC) speak plain text.
- Match the format to the audience — no format serves double duty.

---

## Draft Shape

Drafts are stored in-memory only (in the Zustand store) as a two-field object. There is no persistence or migration across sessions.

```js
drafts: { 
  chat: { 
    text: "line1\n\nline2", 
    json: { type: "doc", content: [...] } 
  } 
}
```

---

## The Rule: Store Write Contract

Three write patterns determine how text and JSON are handled, with `json` acting as a cache validity flag:

| Writer | Writes | Rule |
|---|---|---|
| **Editor `onUpdate`** | `{ text, json }` | Atomic dual-write from the same editor state. |
| **External** (speech, refine, clear) | `{ text, json: null }` | Invalidates cache, forces hydration from text. |
| **Mode init** (edit:user, prompt) | `{ text, json: null }` | Text from message/prompt, no cache yet. |

The consumer-facing API (`setContent`) has no `json` parameter — it always invalidates the JSON cache. External writers physically cannot preserve stale JSON. The invalidation is baked into the function signature.

---

## Store and Hook APIs

### Public Hook API (`useComposer`)
Returns `{ text, saveDraft, setContent, submit, ... }`. No `json` is exposed in the public API — consumers don't know it exists. 

### Internal API (`useComposerJson`)
A separate hook (or direct `_composerStore` selector) gives `ComposerEditor` access to the json cache without exposing it on the main hook.

### Store Actions
```js
composerActions = {
  setMode: (sid, mode, overrides) =>
    // edit modes init with { text: '', json: null }
    // non-edit modes: leave existing draft untouched

  saveDraft: (sid, mode, text, json) =>
    // Editor-internal: atomic dual-write
    _put(sid, s => ({ ...s, drafts: { ...s.drafts, [mode]: { text, json } } }))

  setContent: (sid, mode, text) =>
    // Consumer-facing: text only, json always null
    _put(sid, s => ({ ...s, drafts: { ...s.drafts, [mode]: { text, json: null } } }))
}
```

---

## Editor Lifecycle (`ComposerEditor`)

### 1. Mount
Prefer the `json` cache for lossless restoration. If null, fall back to an empty string. The `onCreate` callback hydrates from `text` when the editor starts empty (e.g., first entry into prompt mode with a system prompt, or edit mode with no cached draft). It checks `editor.isEmpty` rather than `!json` because tiptap uses a ref pattern for callbacks — by the time `onCreate` fires, React state may have shifted, but `editor.isEmpty` reflects the actual document.
```js
const editor = useEditor({
  extensions,
  content: json || '',
  onCreate: ({ editor }) => {
    if (editor.isEmpty && text) editor.commands.setHydratedContent(text)
  },
})
```

### 2. onUpdate (User types)
Perform an atomic dual-write to keep `text` and `json` in sync.
```js
onUpdate: ({ editor }) => {
  if (isExternalUpdate.current) return
  const currentText = editor.getText()
  const currentJson = editor.getJSON()
  textRef.current = currentText
  saveDraft(currentText, currentJson)
}
```

### 3. External Content Change (useEffect)
Fires when text changes from outside (e.g., speech, refine). Since external writes set `json: null`, the editor lacks a valid cache and hydrates from the new text.
```js
useEffect(() => {
  if (!editor) return
  if (text === textRef.current) return
  
  textRef.current = text
  isExternalUpdate.current = true
  editor.commands.setHydratedContent(text)
  isExternalUpdate.current = false
}, [text])
```

---

## Remount Coverage

Every case where `json` would change triggers the right behavior:

| Scenario | Mechanism | Content source |
|---|---|---|
| **Chat ↔ Prompt switch** | Different component variant, full remount | `json` from store (if cached), otherwise `onCreate` hydrates from `text` |
| **Session switch** | `key={sid}` forces remount | `json` from store (if cached) |
| **Chat ↔ Edit switch** | Same component, no remount | `text` useEffect fires `setHydratedContent` |

---

## Hydrator Extension Scope

The Hydrator is no longer the bottleneck for internal save/restore (which now uses the lossless JSON→JSON path). Its scope shrinks to acting as an "external text adapter":
- `setHydratedContent` command — still needed to ingest external text (speech, refine).
- `handlePaste` plugin — paste is always treated as external text.
