Global Styling Rules:
- No focus ring anywhere to match native app feel.
- No HTML tooltips; always use the native tooltip.

State Rules:
- **Domain State (Global):** Use `useSubscription` for global data from main (session list, models, prompts). Read-only; mutate via `api.call()`, which triggers a server push back.
- **Domain State (Session-Scoped):** `SessionContext` receives `session:state:listen` pushes and applies partial payloads into the `Chat` instance. Do not request-then-cache session state — rely on main to push.
- **Streaming Ownership:** During active streaming (`status !== 'ready'`), `Chat` owns message state via the transport. Main must not push messages while streaming. Branch switch and message edit must be disabled in UI while streaming.
- **Local UI State:** Use `useState` strictly for local component UI state.
- **Global UI State (Zustand):** 
  - Read state reactively: `useAppStore(s => s.value)`
  - Call actions imperatively: `act().someAction()` (in handlers)