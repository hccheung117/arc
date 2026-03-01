Global Styling Rules:
- No focus ring anywhere to match native app feel.
- No HTML tooltips; always use the native tooltip.

State Rules:
- **Domain State:** Use `useSubscription` to read data from the main process (it returns data only, no setter). NEVER copy it into local `useState`. Mutate via `api.call()`, which triggers a server push back.
- **Local UI State:** Use `useState` strictly for local component UI state.
- **Global UI State (Zustand):** 
  - Read state reactively: `useAppStore(s => s.value)`
  - Call actions imperatively: `act().someAction()` (in handlers)