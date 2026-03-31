Global Styling Rules:
- No focus ring anywhere to match native app feel.
- No HTML tooltips; always use the native tooltip.
- Text selection is disabled globally (`select-none` on `body`). Opt in with `select-text` only on editable content components. Form elements (`input`, `textarea`) are immune automatically.
- Scrollbar sizing: Two tiers via CSS vars — `--scrollbar-w` (default) and `--scrollbar-w-sm` (smaller). Add `.scrollbar-sm` class to opt a scroll container into the smaller size. Use `scrollbar-gutter: stable` + `pr-0` on child groups so left/top/right spacing is pixel-equal (see `CommandList`/`SidebarContent`).

State Rules:
- **Domain State (Global):** Use `useSubscription` for global data from main (session list, models, prompts). Read-only; mutate via `api.call()`, which triggers a server push back.
- **Domain State (Session-Scoped):** `SessionContext` receives typed `session:state:feed` events (`snapshot`, `tip`, `status`, `patch`) from main's SessionStore and applies them via a reducer. Do not request-then-cache session state — rely on main to push.
- **Streaming Safety:** Two operations are unsafe while the LLM is streaming: (1) sending a new LLM request (`sendMessage`), and (2) switching branches. Both are guarded at the action layer — `use-composer.js` for submit, `SessionContext` for branch switch. Use `useLLMLock()` for the busy signal; use `isLLMBusy(status)` where hooks aren't available. UI disabling is visual feedback, not the safety mechanism.
- **Status for presentation only:** Components may read `status` directly for presentation (icon changes, shimmer, CoT auto-open). This is not behavioral gating — it's visual treatment.
- **Local UI State:** Use `useState` strictly for local component UI state.
- **Global UI State (Zustand):** 
  - Read state reactively: `useAppStore(s => s.value)`
  - Call actions imperatively: `act().someAction()` (in handlers)