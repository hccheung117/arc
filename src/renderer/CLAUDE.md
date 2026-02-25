Global Styling Rules:
- No focus ring anywhere to match native app feel.
- No HTML tooltips; always use the native tooltip.

State Rules:
- Domain state comes from main process via `useSubscription` — never copy it into local `useState`.
- `useSubscription` returns data only (no setter). Mutations go through `api.call()`, which triggers a server push back.
- `useState` is only for UI state.