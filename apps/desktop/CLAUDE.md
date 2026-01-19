# App Development Guidelines

## Agent-First Development

**MANDATORY:** Always launch the specialized agents for development tasks. Do not attempt to modify core systems without the appropriate agent.

- **Foundation Developer** (@foundation-developer)
  - Use for: `main/foundation/`
- **Kernel Developer** (@kernel-developer)
  - Use for: `main/kernel/`
- **Module Developer** (@module-developer)
  - Use for: `main/modules/`

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

### Push Events
**One cause, one event. Consumers own their concerns.**
1. **One event per cause** — Emit for the action (e.g., `deleted`), not the effect (e.g., `refreshList`).
2. **Consumers own refresh** — Renderer knows its data dependencies.
3. **Sync before emit** — Complete writes before broadcasting.

## Process-Specific Guidelines

- **Main Process**: @src/main/CLAUDE.md
- **Renderer Process**: @src/renderer/CLAUDE.md
