# App Development Guidelines

This Electron application uses a main-renderer architecture built with Vite. The main process handles backend concerns—AI integration, IPC, file system—while the renderer process owns UI presentation.

## Core Mental Model: Command Pattern

**The trigger is incidental. The domain is essential.**

For example, a "delete thread" operation is the same whether triggered by button click, context menu, or keyboard shortcut. All user intents become Commands that flow through a single domain handler. See @src/main/CLAUDE.md for backend flow, @src/renderer/CLAUDE.md for UI flow.

**Key principles:**

1. **Domain-centric split** — Group by what (e.g., threads, profiles, ai), not by how (e.g., IPC, menu, keyboard)
2. **Single source of truth** — Each domain has one command handler that decides all events
3. **Effects as data** — Domain returns `{ result, events }`, caller broadcasts
4. **Unidirectional flow** — Commands down, events up. No scattered side effects.

## Core Mental Model: Ownership Handoff

**Threads are born local, transferred to DB on first message.**

New chats exist only in renderer memory until the user sends a message. This avoids empty threads in storage and enables instant "New Chat" without backend latency.

```
[New Chat] → owner: 'local' → [First Message] → config bundled with IPC → owner: 'db'
                ↓                                        ↓
        Renderer owns state                      Backend owns state
        UPSERT preserves local                   UPSERT accepted as-is
```

**Key principles:**

1. **Explicit ownership** — `owner: 'local' | 'db'` field on ChatThread tracks who owns the source of truth
2. **Atomic handoff** — Thread config (systemPrompt, etc.) bundled with first message IPC, created together
3. **UPSERT guards** — When `owner === 'local'`, backend events don't overwrite local config
4. **Blocking during send** — `InputMode: 'sending'` prevents config edits during the handoff window

## Core Mental Model: Boundary Guard

**Zod guards I/O; everything else trusts types.**

External data is untrusted—whether from disk, network, or renderer. Validation happens once at the boundary where data enters, then internal code trusts the typed result.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Renderer  │     │    Disk     │     │   Network   │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │ IPC               │ Files             │ HTTP
       ▼                   ▼                   ▼
┌─────────────┐     ┌─────────────────────────────────┐
│ @contracts/ │     │          @boundary/             │  ◄── Zod here
└──────┬──────┘     └───────────────┬─────────────────┘
       │ types                      │ types + accessors
       ▼                            ▼
┌─────────────────────────────────────────────────────┐
│              app/ + lib/ + foundation/              │  ◄── No Zod
└─────────────────────────────────────────────────────┘
```

**Key principles:**

1. **Trust boundary = module boundary** — If a module doesn't guard I/O, it doesn't import Zod
2. **Schema ownership** — Schemas live where data enters: `@contracts/` for IPC, `@boundary/` for disk/network
3. **Types flow inward** — Boundary modules export types; internal modules import types only
4. **Validate once** — After crossing a boundary, data is trusted. No redundant validation.

**The heuristic:** "Should I use Zod here?" → "Does this module guard untrusted input?"

## IPC Communication

**Contract-first: Define once, derive everything.**

Request-response IPC uses contracts that generate channel names, input validation, handler registration, and typed clients. This eliminates triple-definition (types, preload wiring, handler schemas).

| Pattern | Direction | Approach |
|---------|-----------|----------|
| Two-way | Renderer → Main with response | Contract-based |
| Push | Main → Renderer | Event subscription |
| One-way | Renderer → Main (rare) | Direct send (logging only) |

**Adding new IPC:**
1. Add operation to domain contract
2. Implement handler via contract registration
3. Client auto-generated—no preload changes needed

## Type Architecture

**`@contracts/` + `@boundary/` = the only places types are defined with Zod.**

There is no separate "shared types" layer. Types flow from boundary modules inward:

| What | Where | Zod? |
|------|-------|------|
| IPC input schemas | `@contracts/*.ts` | Yes |
| IPC output types | `@contracts/*.ts` | No (TypeScript only) |
| Persistence schemas | `@boundary/*.ts` | Yes |
| Domain types | `lib/` imports from above | No |

See [Boundary Guard](#core-mental-model-boundary-guard) for the validation model.

## Push Events

**One cause, one event. Consumers own their concerns.**

Events notify the renderer of domain state changes. Design events around the cause (what happened), not the effects (what needs updating).

```
WRONG:  action triggers → main emits primary event
                        → main emits derived event A
                        → main emits derived event B (forgotten!)

RIGHT:  action triggers → main emits primary event
                              ↓
                         consumers subscribe
                         and refresh as needed
```

**Key principles:**

1. **One event per cause** — Emit for the action that happened. Derived events fragment causality, create coupling, and invite omissions.
2. **Consumers own refresh** — Renderer knows its data dependencies. Main process shouldn't guess what UI state to invalidate.
3. **Sync before emit** — Complete all storage/cache writes before broadcasting. Prevents race conditions where consumers fetch stale data.
4. **Domain semantics** — Event types describe state transitions (`installed`, `deleted`), not implementation details (`cacheUpdated`, `needsRefresh`).

## Process-Specific Guidelines

- @src/main/CLAUDE.md — Four-layer architecture, contract-first IPC, command pattern, logging
- @src/renderer/CLAUDE.md — UI philosophy, reactive event handling, components, typography
