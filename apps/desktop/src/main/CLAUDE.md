# Main Process

> Implementation details for backend concerns.

## Four-Layer Architecture

```
contracts/  → IPC definitions (schemas, type derivation)
app/        → routing (IPC → command → broadcast)
lib/        → domain logic (commands, persistence, business rules)
foundation/ → infrastructure (logger, ipc, storage, contract primitives)
```

**Import rules:**

- `contracts/` — imports from `foundation/` only
- `foundation/` — no imports from `lib/`, `app/`, or `contracts/`
- `lib/` — only imports from `foundation/`
- `app/` — imports from `contracts/`, `lib/`, and `foundation/`

Same-level imports are design smells. When module A imports sibling B, redistribute: push shared pieces down to a lower layer, extract to a new module both depend on, or have the caller provide it.

## Contract-First IPC

Contracts define the IPC surface. Everything else is derived.

### Principles

1. **Single object parameter** — All operations take one object (or void). Never positional parameters.
2. **Schema at the boundary** — Input validation happens once, in the contract. Handlers trust their input.
3. **Types flow from contracts** — Export types from contracts. Renderer imports from contracts, not separate type files.
4. **Channels are derived** — Never hardcode channel strings. Contract generates them.

### Adding a New Operation

1. **Contract**: Define the operation with input schema and output type
2. **Handler**: Register handler using contract utilities—validation is automatic
3. **Client**: Auto-generated. No preload changes needed.

### When NOT to Use Contracts

- **Push events** — Main→Renderer broadcasts are manual (event subscription pattern)
- **One-way fire-and-forget** — Rare cases like error logging use direct send

### Anti-Patterns

| ❌ Avoid | ✅ Prefer |
|----------|----------|
| Multiple positional parameters | Single object with named fields |
| Manual channel strings | Contract-derived channels |
| Validation in handler | Schema in contract |
| Types separate from contracts | Types exported from contracts |
| Raw IPC calls in renderer | Typed client via `window.arc` |

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
