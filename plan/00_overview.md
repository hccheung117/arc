# Arc — UI-first build plan

## S0 — Monorepo & tooling bootstrap

**Goal:** repo installs, lints, typechecks, builds.

**Scope**

* pnpm + Turborepo monorepo: `apps/web`, `apps/desktop` (Electron). UI tokens/components live in `apps/web`.
* TS strict, ESLint, Prettier, Vitest.
* Minimal CI: lint + typecheck + unit tests.
* LICENSE: Apache-2.0.

**Depends on:** none.
**Exit criteria (verify)**

1. `pnpm i && pnpm -w build` succeeds (0 type errors).
2. `pnpm -w test` runs a placeholder test and passes.
3. CI run shows ✅ lint/typecheck/test.

---

## S1 — Minimal placeholder UI + Electron smoke

**Goal:** prove the **stack boots** (Next, Tailwind, shadcn/ui, Electron).

**Scope**

* `apps/web`: Next 15 + Tailwind 4 + shadcn/ui installed; a single layout with sidebar, header, content.
* `apps/desktop`: tiny Electron main process that loads the web dev URL in dev (no preload/IPC yet).

**Depends on:** S0.
**Exit criteria (verify)**

1. Web: `pnpm --filter web dev` → `localhost:3000` shows “Arc shell”.
2. Electron: `pnpm --filter desktop dev` opens a window rendering the same page.
3. Tailwind classes and shadcn Button render identically in web & Electron.

---

## S2 — Clickable mockup (foundation: windows & layouts)

**Goal:** lock the **application shell** and responsive behavior.

**Scope**

* Sidebar (chat list), main (message panel), composer bar; responsive breakpoints; keyboard focus ring.
* Electron window basics: min size, resize, app menu (About/Quit), dark-mode titlebar.
* No data yet; just placeholders and skeletons.

**Depends on:** S1.
**Exit criteria (verify)**

1. Resize Electron/web from 320px → 1440px: no overlap/overflow; sidebar auto-collapses on <768px.
2. Keyboard: `Ctrl/Cmd+K` opens a placeholder command palette; focus trap works (Esc closes).
3. App menu exists in Electron and is clickable (even if actions are no-ops).

---

## S3 — Clickable mockup (design & UX flows)

**Goal:** validate **screen flow** before any data.

**Scope**

* First-run screen → “Connect provider” modal (nonfunctional).
* Settings drawer (theme, font size) with client-side validation only.
* Empty states: no chats, no messages; loading skeletons.
* Interaction timing: avoid layout shift; show busy indicators.

**Depends on:** S2.
**Exit criteria (verify)**

1. From fresh load: open Settings, toggle theme & font size, close → UI updates instantly, no hydration warnings.
2. Open “Connect provider” modal → required fields show inline errors on blur/submit.
3. Navigate between Home ↔ Settings ↔ New Chat without any visible layout jumps.

---

## S4 — Simple **fake data** to verify the user journey

**Goal:** end-to-end **happy path** with in-memory state.

**Scope**

* Local store (e.g., Zustand): `chats[]`, `messages[]`, `activeChatId`.
* Composer “Send” → append user message; **fake streaming** assistant via `setInterval` with a canned response.
* Buttons visible **and** clickable: Stop, Regenerate (restarts fake stream), Delete message, New Chat, Rename Chat.

**Depends on:** S3.
**Exit criteria (verify)**

1. Create chat → send “Hello” → characters stream in; click **Stop** → halts within 1s.
2. Click **Regenerate** → the last assistant message is replaced by a new streaming response.
3. Create 2nd chat, switch back and forth: message lists are isolated; no console errors.

---

## S5 — Rendering (text fidelity)

**Goal:** realistic message rendering; still mock data.

**Scope**

* Markdown with code fences + copy button; autolink URLs; inline code.
* Optional: KaTeX/MathJax for LaTeX; Mermaid for diagrams.
* Themeable typography & spacing tokens (via shadcn).

**Depends on:** S4.
**Exit criteria (verify)**

1. Paste a message with a code block → syntax highlighting appears; **Copy** copies exact code.
2. Send a Mermaid block → diagram renders without layout shift.
3. Send LaTeX `E=mc^2` → renders correctly.

---

## S6 — Images (UI/UX only, no real FS)

**Goal:** attachment UX validated.

**Scope**

* Drag/drop & paste image → preview chip in composer.
* On send, show image bubble using ObjectURL; lightbox with zoom; multi-image gallery layout.
* Size/type validation with friendly errors.

**Depends on:** S5.
**Exit criteria (verify)**

1. Drag a PNG → preview appears; Send → thumbnail in timeline; click → lightbox opens; Esc closes.
2. Paste a JPEG from clipboard → same behavior.
3. Try a 20MB file → inline error banner with reason (“too large”).

---

## S7 — “The rest of fancy things” (now, bring logic in safely)

Break this into bite-sized, swappable modules behind a **single interface** the UI already uses.

### S7a — Interface seam (Mock ⇄ Live)

* Define `IChatAPI` used by UI (`send`, `stop`, `regenerate`, `listChats`, `createChat`, `deleteMessage`, `search`).
* Keep current behavior in `MockChatAPI`; add a switch in a Dev panel to swap to `LiveChatAPI`.

**Depends on:** S6.
**Exit criteria:** toggling Mock/Live does **not** change UI flows (Live can be “not implemented” but must stub).

### S7b — Headless Core (in-memory first)

* Create `packages/core` with domain types & services; in-memory repos only.

**Depends on:** S7a.
**Exit criteria:** Live mode backed by Core reproduces S4–S6 behaviors 1:1; unit tests pass.

### S7c — Real provider (OpenAI first)

* `PlatformHTTP` with AbortController + streaming; OpenAI adapter (health check, completions).
* Error mapping (401/429/timeout) → friendly banners.

**Depends on:** S7b.
**Exit criteria:** valid key streams real tokens; Stop/Regenerate work; bogus key shows “Invalid API key”.

### S7d — Persistence (SQLite for web via sql.js)

* `packages/db` schema + migrations; replace in-memory repos with SQLite behind the same interfaces.
* Draft autosave.

**Depends on:** S7c.
**Exit criteria:** chats/messages/drafts persist across reload; migration bump succeeds.

### S7e — Search & performance polish

* Per-chat and global search (FTS or LIKE to start).
* Virtualized message list; reconnect/timeout handling.

**Depends on:** S7d.
**Exit criteria:** 1,000 seeded messages scroll smoothly; search highlights correct hits; network flake shows graceful UI.

### S7f — Desktop fit-and-finish (Electron)

* `platform-electron`: file-backed SQLite (`better-sqlite3`), real file pick/save, “Check for updates” stub.

**Depends on:** S7d.
**Exit criteria:** quit/reopen retains data; attach a local image file; menu action opens an updates modal.

*(Mobile via Capacitor can be S7g if/when you want it.)*

---

## Dependency map

```
S0 → S1 → S2 → S3 → S4 → S5 → S6 → S7a → S7b → S7c → S7d → S7e → S7f
      (pixels)   (UX)   (fake flow) (render) (images)      (logic & perf)  (desktop polish)
```

---

## Practical guardrails

* **Pixel parity first:** don’t start Core/DB until S6 passes; otherwise you’ll redo UI.
* **One seam to rule them all:** all data goes through `IChatAPI`; swaps Mock→Live without touching components.
* **Fast feedback:** every phase ends with a 2–3 minute manual checklist (the exit criteria above).