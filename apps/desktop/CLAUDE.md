# App Development Guidelines

## Core Mental Models

### Command Pattern
**The trigger is incidental. The domain is essential.**
All user intents become Commands that flow through a single domain handler.
1. **Domain-centric split** — Group by what (e.g., threads, profiles), not by how.
2. **Single source of truth** — Each domain has one command handler.
3. **Effects as data** — Domain returns `{ result, events }`.
4. **Unidirectional flow** — Commands down, events up.

### Ownership Handoff
**Threads are born local, transferred to DB on first message.**
1. **Explicit ownership** — `owner: 'local' | 'db'` tracks source of truth.
2. **Atomic handoff** — Thread config bundled with first message IPC.
3. **UPSERT guards** — Backend events don't overwrite local config while `owner === 'local'`.
4. **Blocking during send** — `InputMode: 'sending'` prevents edits during handoff.

### Thread Emergence
**A thread is a consequence, not a container.**
Threads exist because a message was sent — not to hold future messages.
1. **Persistence is commitment** — Empty chats live in memory; only sent messages reach disk.
2. **Emerge on send** — `threads.create()` called from renderer's send flow, before `messages.create()`.
3. **Idempotent creation** — Duplicate creates are no-ops; safe for retries and race conditions.

### Push Events
**One cause, one event. Consumers own their concerns.**
1. **One event per cause** — Emit for the action (e.g., `deleted`), not the effect (e.g., `refreshList`).
2. **Consumers own refresh** — Renderer knows its data dependencies.
3. **Sync before emit** — Complete writes before broadcasting.

## Process-Specific Guidelines

- **Main Process**: @src/main/CLAUDE.md
- **Renderer Process**: @src/renderer/CLAUDE.md
