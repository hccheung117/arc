# Renderer Process

> Implementation details for UI concerns.

## Philosophy

**Everything is a Function.**

### The Core Question

Not "feature-based vs flat" — but **where does the brain live?**

Components can own logic (smart), or functions can own logic and components just render (dumb). We chose the latter.

### Why Not Feature-Based

The Renderer's concerns are highly interconnected. Almost every UI surface touches the same shared state — active thread, streaming, profile, settings. Feature boundaries become leaky immediately. Grouping by feature creates artificial walls that every piece of real work must cross.

No "features" because the domain doesn't have clean boundaries. Instead: **layers by role**.

## Architecture

### The Three Layers

```
  STORE → HOOKS → COMPONENTS

  Store:       The brain. State lives external to components.
  Hooks:       The derivation layer. Select, compute, expose actions.
  Components:  The render layer. Receive data and callbacks. No brain.
```

### Code Organization

Layered structure following Laravel-style organization:

- `@renderer/components/` — React components (UI primitives + app components)
- `@renderer/context/` — React contexts
- `@renderer/hooks/` — React hooks
- `@renderer/stores/` — Zustand stores
- `@renderer/lib/` — Utilities, domain logic, and business logic

## Architectural Principles

1. **State is external** — store, not component. Components don't own state they didn't create.
2. **Logic is derived** — hooks select and compute from the store. They are the API surface.
3. **Components are dumb** — render what they're given. No business logic, no direct store access.
4. **Cross-cutting is solved** — a centralized store is already global. No context nesting for shared state.
5. **Layers by role, not by feature** — organize by what code *does* (store / hook / component / lib), not what domain concept it belongs to.

### Alignment with Main

Same philosophy, different medium:

```
  Main:      Modules are stateless → derive from disk
  Renderer:  Components are stateless → derive from store
```

Both treat their actors as pure functions over external state. The brain lives outside.

### When to Break the Rules

Context is appropriate for **identity** (which thread? which message?) — scoping, not state. Local `useState` is fine for **ephemeral UI** (tooltip open, input focus) that no other component needs. The line: if another component might care, it belongs in the store.

## Data Flow

The renderer is purely reactive: send commands, receive events.

```
User Action → IPC invoke → Main executes → Events broadcast → Reducer updates → UI re-renders
```

**All domain operations via IPC.** Button clicks, menu selections, keyboard shortcuts all invoke domain IPC handlers. The renderer never decides what events an operation produces—it just receives and applies them.

**Context menus:** Call `showContextMenu()`, receive action string, then invoke the appropriate domain IPC. Menu handlers in main never execute domain logic.

## UI Principles

### Native Desktop Feel

**Non-selectable by default.** Global stylesheet applies `select-none cursor-default`. Opt in with `select-text cursor-text` for copyable content: messages, inputs, errors, code.

**Native context menus only.** Never custom React menus. Build via `Menu.buildFromTemplate()` in main—gives OS styling, accessibility, keyboard nav for free.

### ViewModel Layer

Decouple UI state from persistence to avoid blinking, waiting states, and leaked abstractions.

**Stable IDs.** ChatThread gets a cuid2 ID on creation, before any database call. Same ID becomes `conversationId` when persisted.

**Lazy persistence.** "New Chat" creates a ChatThread instantly. Database materializes on first message. Empty conversations never exist in storage.

**Optimistic updates.** Messages appear immediately. Backend operations run async. Errors surface without blocking.

## Implementation Standards

### Components

Uses **shadcn/ui**. Install to `@renderer/components/ui` exclusively:

```bash
npx shadcn-ui@latest add <component>
```

### Typography

Semantic scale from `tailwind.config.js`:

| Token | Use |
|-------|-----|
| `text-display` | Hero text, empty states |
| `text-title` | Page headers |
| `text-subtitle` | Secondary headings |
| `text-body` | Messages, prose |
| `text-label` | Buttons, navigation, forms |
| `text-meta` | Captions, badges, tooltips |

Never use raw utilities (`text-sm`, `text-xs`)—always semantic tokens.

### State Persistence

UI state that survives sessions persists via IndexedDB in the renderer.

### Props vs Context

**Context for identity, props for variation.**

Use this decision tree when adding new data to components:

| Question | Answer | Delivery |
|----------|--------|----------|
| Does every child need the same value? | Yes | Context |
| Does it identify "where we are"? (threadId, messageId) | Yes | Context |
| Does a sibling need a different value? | Yes | Props |
| Is it an action operating on identity? | Yes | Hook + context |

**Established context boundaries:**

- `ThreadProvider` — wraps `ChatView`, provides `threadId` via `useThreadId()`
- `MessageProvider` — wraps each message in `MessageList`, provides `messageId`/`role` via `useMessageContext()`

**Why this matters:** Props are easy to add but accumulate debt. Context requires upfront investment but prevents drilling. If you find yourself passing a prop through 2+ components that don't use it, refactor to context.
