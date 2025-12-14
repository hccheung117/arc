# App Development Guidelines

This Electron application uses a main-renderer architecture built with Vite. The main process handles backend concerns—AI integration, IPC, file system—while the renderer process owns UI presentation.

## Architecture

### Main Process

The main process manages AI streaming through an event-based push model. Streaming state divides into three categories:

**In-memory only:** Typing indicators, chunk buffers, active stream tracking (`Map<streamId, AbortController>`), and transient errors during streaming.

**Persisted to database:** Complete user messages (immediately on send), complete assistant messages (only after stream finishes), and conversation metadata.

**Never persisted:** Partial responses, streaming progress, and temporary error states.

### Renderer Process

Code organization follows a simple rule: shared code lives at the root level, feature-specific code lives in feature directories.

- `@renderer/components/` — Shared React components
- `@renderer/hooks/` — Shared React hooks (`use...`)
- `@renderer/lib/` — Shared utilities and libraries
- `@renderer/features/<name>/` — Feature-specific code

### IPC Communication

Three patterns based on direction and response requirements:

| Pattern | Direction | API |
|---------|-----------|-----|
| One-way | Renderer → Main | `ipcRenderer.send()` / `ipcMain.on()` |
| Two-way | Renderer → Main with response | `ipcRenderer.invoke()` / `ipcMain.handle()` |
| Push | Main → Renderer | `webContents.send()` / `ipcRenderer.on()` |

### Three-layer architecture

**Layers**

- `ipc/` → orchestration (composes domain libs, emits events)
- `lib/` → domain libs (business logic, each independent)
- `infra/` → foundation (logger, ipc utils, storage, paths)

**Import rules:**

- `infra/` → no imports from `lib/` or `ipc/`
- `lib/` → only imports from `infra/` (not other libs)
- `ipc/` → imports from `lib/` and `infra/`

## UI Philosophy

### Native Desktop Feel

This is a desktop application, not a web page. Two rules enforce that distinction:

**Non-selectable UI by default.** The global stylesheet applies `select-none` and `cursor-default` to prevent accidental text selection on buttons, labels, and UI chrome. Opt in with `select-text cursor-text` for content users need to copy: chat messages, input fields, error messages, and code blocks.

**Native context menus only.** Never use custom React context menus. Send menu item definitions to main via IPC, construct with `Menu.buildFromTemplate()`, and display with `menu.popup()`. This gives you OS-consistent styling, proper accessibility, correct positioning, and native keyboard navigation for free.

### UI-State-First Architecture

Traditional UI couples presentation to database entities—rendering rows directly, requiring database operations for state changes, forcing users to manage database concepts. This causes blinking on refetch, artificial waiting states, and leaked abstractions.

The solution: a **ChatThread ViewModel layer** that decouples UI state from persistence.

**Unified ID system.** Every ChatThread gets a cuid2 ID immediately on creation, before any database operation. This ID becomes the `conversationId` when persisted. ID stability eliminates re-renders from identity changes.

**Lazy conversation creation.** Clicking "New Chat" creates a ChatThread instantly with no database call. The database conversation materializes on first message send, using the same ID. Empty conversations never exist in storage.

**Message-first mental model.** Users interact with messages, not conversations. Conversations emerge as a by-product of messaging. No mandatory chat management—optional controls appear when users want them.

**Optimistic updates.** Messages appear in the ChatThread immediately. Backend operations happen asynchronously. Errors surface gracefully without blocking the UI.

## Component Library

This project uses **shadcn/ui**. Install components to `@renderer/components/ui` exclusively—this directory is reserved for unmodified shadcn/ui components.

```bash
npx shadcn-ui@latest add <component>
```

## Typography

A semantic scale defined in `tailwind.config.js` ensures consistent hierarchy:

| Token | Size | Use |
|-------|------|-----|
| `text-display` | 36px/44px | Hero text, empty states, onboarding |
| `text-title` | 24px/32px | Page headers, section titles |
| `text-subtitle` | 20px/28px | Secondary headings, emphasized text |
| `text-body` | 16px/24px | Messages, prose, paragraphs |
| `text-label` | 15px/22.4px | Buttons, navigation, form controls |
| `text-meta` | 13px/20px | Captions, badges, tooltips, helper text |

**Rules:**

- Never use raw utilities (`text-sm`, `text-xs`)—always use semantic tokens
- Readable content (chat messages, prose) uses `text-body`
- Interactive elements (buttons, navigation, forms) use `text-label`
- Metadata (categories, badges, tooltips) uses `text-meta`
- Document token choices in comments referencing `tailwind.config.js`

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

## State Persistence

UI state that survives sessions persists in the renderer via IndexedDB.
