Conventions:
- IPC routes should follow the `resource:action` pattern. Push routes use `:feed` for state broadcasts and `:start` for UI-trigger commands (e.g. `session:rename:start`).
- Avoid cross-domain pushes in routes. If a route needs to push another domain's channel, import and call the other domain's channel (e.g. `promptsCh.push()`).
- Every mutation route must push so subscribers stay in sync. Use `channel.mutate(fn)` for CRUD routes (auto-pushes after fn), `channel.push()` / `channel.patch(data)` for explicit cases. No silent mutations.
- `channel.js` defines `defineChannel(name, fetcher, opts)` → `{ push, patch, mutate }`. Use `{ hydrate: false }` for parameterized channels excluded from startup `pushAll()`. Routes should not call raw `push()` from router for state feeds — use the channel API instead. Raw `push()` is only for UI commands (`:start` routes, navigation).
- `services/` contains pure JS business logic and data access — no Electron or router imports. `routes/` is a thin wiring layer that handles IPC registration, Electron UI, and calls `push()` after service mutations.
- `session-store.js` is the in-memory SSOT for live session state (messages, branches, streaming status). It imports `push` directly because broadcasting on every streaming chunk is core to its purpose. It is not a service — services stay pure with no router imports.
- `services/` uses `arcfs.js` IO primitives for file IO.
- Services must not construct paths for another service's domain. Pass pre-built paths across service boundaries.