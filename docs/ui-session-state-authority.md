# UI Pattern: Session State Authority

## Purpose

Session switching reloads state from disk via `session:activate`. Persistence is lazy — assistant messages are only written after streaming completes (`finalize`). This creates a gap where in-flight streaming state exists only in the renderer's Chat instance and would be overwritten by stale disk data on re-entry.

This document defines which layer is authoritative for message state at each point in the lifecycle.

---

## The Rule: Complete vs Incomplete State

| State | Authority | Why |
|-------|-----------|-----|
| **Complete** (ready, error) | Main (disk) | Finalized messages are canonical. Disk is safe to apply. |
| **Incomplete** (submitted, streaming) | Renderer (Chat instance) | In-flight data only exists in memory. Disk is stale. |

The guard in `SessionContext.jsx`:

```js
if (payload.messages && !isLLMBusy(chatRef.current.status)) {
  chatRef.current.setMessages(payload.messages)
}
```

Branches and prompt are always applied — they don't have the same incomplete-state gap.

---

## Why the Chat Instance Survives Switches

The `chatInstances` Map (module-level, outside React) keeps Chat objects alive across session switches. When the user switches away, the Chat instance continues receiving streaming chunks via `IpcTransport`. When they switch back, `useChat` re-binds to the same instance — the data was never lost.

The bug was: `session:activate` fires on re-entry, loads from disk (which lacks the unfinalized assistant message), and `setMessages` overwrites the Chat's live state.

---

## All Sources of `payload.messages`

`session:state:feed` carries messages from multiple origins. The guard only matters for hydration — the others happen while the session is active (Chat status is `ready`):

| Trigger | Source | Chat status at arrival | Overwrites? |
|---------|--------|----------------------|-------------|
| Session activate (first open) | `sessionState.push()` | ready (empty) | Yes |
| Session activate (re-entry, streaming) | `sessionState.push()` | streaming | **No** |
| Session activate (re-entry, finished) | `sessionState.push()` | ready | Yes |
| Branch switch | `sessionState.patch()` | ready | Yes |
| Message edit | `sessionState.patch()` | ready | Yes |
