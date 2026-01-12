# Renderer Process

> Implementation details for UI concerns.

## Code Organization

Shared code at root, feature-specific code in feature directories:

- `@renderer/components/` — Shared React components
- `@renderer/hooks/` — Shared React hooks
- `@renderer/lib/` — Shared utilities
- `@renderer/features/<name>/` — Feature-specific code

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
