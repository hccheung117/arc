# Main Process

The main process manages AI streaming through an event-based push model. Streaming state divides into three categories:

**In-memory only:** Typing indicators, chunk buffers, active stream tracking (`Map<streamId, AbortController>`), and transient errors during streaming.

**Persisted to database:** Complete user messages (immediately on send), complete assistant messages (only after stream finishes), and conversation metadata.

**Never persisted:** Partial responses, streaming progress, and temporary error states.

## Three-Layer Architecture

**Layers**

- `app/` — orchestration (composes domain libs, emits events)
- `lib/` — domain libs (business logic, each independent)
- `foundation/` — infrastructure only (logger, ipc utils, storage, paths)—**no domain knowledge**

**Import rules:**

- `foundation/` — no imports from `lib/` or `app/`
- `lib/` — only imports from `foundation/` (not other libs)
- `app/` — imports from `lib/` and `foundation/`

**Same-level imports are design smells** at any layer. When module A imports from sibling module B, the shared piece either belongs in a new third module they both depend on (if domain-specific), should be pushed down to a lower layer (if generic infrastructure), or should be provided by the caller (if the coupling is incidental). The fix is never to relocate the import—it's to redistribute logic so dependencies flow strictly downward.

## Logging

A two-tier system designed for clarity without flooding:

| Environment | `info` | `warn`/`error` |
|-------------|--------|----------------|
| Dev | Console | Console |
| Prod | Silent | Console + File (`userData/error.log`) |

**Guidelines:**

- One log per operation, not per step
- Concise messages with context: `logger.error('models', 'Fetch failed', err)`
- No logging in loops—aggregate or sample if needed
- No state transition logs

Production error logs rotate automatically: max 5MB, renamed to `error.old.log` on startup if exceeded.
