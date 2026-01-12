# Main Process

> Implementation details for backend concerns.

## Three-Layer Architecture

```
app/        → routing (IPC → command → broadcast)
lib/        → domain logic (commands, persistence, business rules)
foundation/ → infrastructure (logger, ipc, storage, paths)
```

**Import rules:**

- `foundation/` — no imports from `lib/` or `app/`
- `lib/` — only imports from `foundation/` (not other libs)
- `app/` — imports from `lib/` and `foundation/`

Same-level imports are design smells. When module A imports sibling B, redistribute: push shared pieces down to a lower layer, extract to a new module both depend on, or have the caller provide it.

## Command Pattern (lib/)

Each domain exposes a command handler as its single source of truth:

```typescript
type Command =
  | { type: 'delete'; id: string }
  | { type: 'update'; id: string; patch: Patch }
  | { type: 'move'; id: string; targetId: string }

type Effect<T> = { result: T; events: Event[] }

async function execute(cmd: Command): Promise<Effect<...>>
```

Commands return `{ result, events }`. The caller broadcasts events—lib/ never touches IPC.

## Routing Layer (app/)

The app layer is a thin router: translate IPC → command → execute → broadcast → return.

```typescript
async (id) => {
  const { result, events } = await execute({ type: 'delete', id })
  events.forEach(broadcast)
  return result
}
```

Split by **domain**, not trigger mechanism. The same operation flows through one handler regardless of how it was triggered (button, menu, shortcut).

**Context menus return actions only.** UI modules show menus and return the selected action string. They never execute domain logic. The renderer receives the action and calls the appropriate domain IPC.

## AI Streaming

Streaming state divides into three categories:

| Category | Examples |
|----------|----------|
| In-memory only | Typing indicators, chunk buffers, abort controllers |
| Persisted | Complete user messages (immediate), assistant messages (after stream ends) |
| Never persisted | Partial responses, streaming progress, transient errors |

## Logging

| Environment | `info` | `warn`/`error` |
|-------------|--------|----------------|
| Dev | Console | Console |
| Prod | Silent | Console + File |

One log per operation, not per step. No logging in loops.
