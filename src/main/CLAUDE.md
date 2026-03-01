Conventions:
- IPC routes should follow the `resource:action` pattern. For push routes, always use the `:listen` action.
- Every mutation route must trigger a `push()` so subscribers stay in sync. No silent mutations.
- `services/` contains pure JS business logic and data access — no Electron or router imports. `routes/` is a thin wiring layer that handles IPC registration, Electron UI, and calls `push()` after service mutations.
- `services/` uses `arcfs.js` IO primitives for file IO.
- Services must not construct paths for another service's domain. Pass pre-built paths across service boundaries.