Global Styling Rules:
- No focus ring anywhere to match native app feel.
- No HTML tooltips; always use the native tooltip.
- Text selection is disabled globally (`select-none` on `body`). Opt in with `select-text` only on editable content components. Form elements (`input`, `textarea`) are immune automatically.

State Rules:
- **Domain State (Global):** Use `useSubscription` for global data from main (session list, models, prompts). Read-only; mutate via `api.call()`, which triggers a server push back.
- **Domain State (Session-Scoped):** `SessionContext` receives `session:state:feed` pushes and applies partial payloads into the `Chat` instance. Do not request-then-cache session state — rely on main to push.
- **Streaming Ownership:** During active streaming (`status !== 'ready'`), `Chat` owns message state via the transport. Main must not push messages while streaming. Branch switch and message edit must be disabled in UI while streaming.
- **Session Status Guards:** Never compare `status` strings directly for behavioral logic. Use `flags` from `useSession()` — the permission map in `lib/session-status.js` is the single source of truth.
- **Local UI State:** Use `useState` strictly for local component UI state.
- **Global UI State (Zustand):** 
  - Read state reactively: `useAppStore(s => s.value)`
  - Call actions imperatively: `act().someAction()` (in handlers)