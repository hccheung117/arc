# App Development Guidelines

This document outlines development practices for the Arc desktop Electron application built with Vite. The app follows a main-renderer architecture where the main process handles backend concerns (database, AI, IPC) and the renderer process handles UI presentation.

## 1. Backend Development (Main Process)

### 1.1. Database Migration Workflow

We enforce a **"Push-then-Squash"** workflow to keep migration history clean (one migration file per release).

**Local Development: `npm run db:dev`**
- **When to run:** Whenever you modify `schema.ts` or pull changes
- **What it does:** Pushes schema changes directly to your local SQLite database (`drizzle-kit push`)
- **Outcome:** Your local DB is synced. **No migration files are created**

**Release Preparation: `npm run db:release`**
- **When to run:** Only when preparing a version bump PR
- **What it does:** Compares your current schema against the last released migration and generates a new one (`drizzle-kit generate`)
- **Outcome:** **One** new migration file is created for the release

### 1.2. AI Integration

**Core Principle: Vercel AI SDK as Primary Interface**

All AI provider integrations MUST use the **Vercel AI SDK** (`ai` package) as the universal interface. This provides:
- Consistent API across multiple providers (OpenAI, Anthropic, Google, etc.)
- Built-in streaming support with standardized event types
- Framework-agnostic core for Electron compatibility
- TypeScript-first design with excellent type safety

**DO NOT** integrate provider SDKs directly (e.g., `openai` package). Use Vercel AI SDK's provider packages (e.g., `@ai-sdk/openai`, `@ai-sdk/anthropic`).

**IPC Streaming Pattern**

AI responses stream from main process to renderer using an event-based push model.

**Streaming State Management**

Distinguish between transient streaming state and persistent data:

*In-Memory Only:*
- Streaming status (typing indicators, chunk buffers)
- Active stream tracking (`Map<streamId, AbortController>`)
- Transient errors during streaming

*Persisted to Database:*
- Complete user messages (immediately on send)
- Complete assistant messages (only after stream finishes)
- Conversation metadata (timestamps, participant info)

*Never Persist:*
- Partial/incomplete assistant responses
- Streaming progress indicators
- Temporary error states

## 2. Frontend Development (Renderer Process)

### 2.1. Directory Structure

Code that is reusable across multiple, unrelated parts of the application belongs in the root-level directories:

- `@renderer/components/`: Shared React components
- `@renderer/hooks/`: Shared React hooks (`use...`)
- `@renderer/lib/`: Shared utility functions and libraries

Feature-specific code should be organized within feature directories (e.g., `@renderer/features/workbench/`).

### 2.2. UI Components (shadcn/ui)

This project uses **shadcn/ui** for its component library.

**Installation Path**

All shadcn/ui components **must** be installed in the `@renderer/components/ui` directory. This directory is reserved exclusively for unmodified shadcn/ui components. Do not place custom components here.

**Adding New Components**

Always use the official `shadcn-ui` CLI to add new components:

```bash
# Example: Adding a button component
npx shadcn-ui@latest add button
```

### 2.3. Typography System

The app uses a centralized semantic typography scale defined in `tailwind.config.js`. This system ensures consistent visual hierarchy and makes global typography changes straightforward.

**Typography Scale**

Six semantic tokens replace arbitrary size utilities:

- **text-display**: 36px/44px - Hero text, empty states, onboarding screens
- **text-title**: 24px/32px - Page headers, section titles
- **text-subtitle**: 20px/28px - Secondary headings, emphasized text
- **text-body**: 16px/24px - Messages, prose, readable paragraph content
- **text-label**: 15px/22.4px - Buttons, navigation, form labels, UI chrome
- **text-meta**: 13px/20px - Captions, badges, tooltips, helper text

**Usage Rules**

*Content (Readable Text):*
- Messages and chat content use `text-body` for comfortable reading
- Markdown and prose use the `prose` class, configured to body size
- Any paragraph-length content defaults to `text-body`

*Interactive Elements:*
- Buttons, navigation items, and tabs use `text-label`
- Form controls (inputs, textareas) use `text-label` (15px) consistently
- Desktop-only application: no responsive font scaling needed

*Hierarchy & Metadata:*
- Category headers, provider labels, and section dividers use `text-meta`
- Tooltips, badges, and notification indicators use `text-meta`
- Helper text and secondary descriptions use `text-meta`

**Design Principles**

- **Never use raw size utilities** - Always prefer semantic tokens over `text-sm`, `text-xs`, or `text-base`
- **Readable content uses body** - Chat messages, prose, and paragraphs default to 16px for comfortable reading
- **Interactive elements use label** - Buttons, navigation, and forms use 15px for compact, consistent UI chrome
- **Metadata uses meta** - Categories, badges, and tooltips use 13px to create clear hierarchy
- **Document your choices** - Add comments explaining why each token was chosen and reference `tailwind.config.js`

### 2.4. UI-State-First Architecture

**The Problem: Data-Model-First UI**

Traditional UI implementations tightly couple presentation state to database entities. The UI renders database rows directly, state changes require database operations, and the user is forced to interact with database concepts. This creates several issues:

- **Blinking and flashing**: As database entities are created or updated, the UI must refetch and re-render, causing visual disruptions
- **Artificial waiting states**: Users cannot interact until database operations complete
- **Leaked database concerns**: Users must "create conversations" or manage database entities explicitly
- **Poor UX for lazy operations**: Operations that should be instant require roundtrips to the backend

**The Solution: ChatThread ViewModel Layer**

We introduce a **UI ViewModel layer** that decouples UI state from database persistence. This layer uses **ChatThreads** as the primary abstraction for organizing messages in the UI, independent of how they're stored in the database.

**Dual Identity System**

- Every chat has a **threadId** (UI identity) that is stable and never changes
- Every chat has a **conversationId** (database identity) that is created lazily when needed
- The UI references threadId exclusively; only backend APIs use conversationId
- This separation allows the UI to exist and update independently of database state

**Lazy Conversation Creation**

- When users click "New Chat", a ChatThread is created immediately with a threadId
- The thread appears in the sidebar instantly with no database operation
- The conversationId remains null until the user sends their first message
- On first message send, we generate a conversationId and persist to the database
- This ensures empty conversations never exist in the database

**Message-First User Mental Model**

- Users interact with messages, not conversations
- Conversations emerge automatically as a by-product of messaging
- No mandatory chat management (no create/edit/delete required for basic usage)
- Optional management features available when users want control

**Optimistic Updates**

- Messages are added to the ChatThread immediately when sent
- UI updates instantly without waiting for backend confirmation
- Backend operations happen asynchronously in the background
- Errors are handled gracefully without blocking the UI

**Benefits**

This architecture delivers significant user experience and code quality improvements:

- **Zero blinking/flashing**: ThreadId stability means UI never re-renders due to identity changes
- **Instant feedback**: New chats appear immediately, no waiting for database roundtrips
- **Optimistic responsiveness**: Messages appear instantly, streaming happens in background
- **Draft support**: Unsent messages can persist in threads (future feature)
- **Cleaner separation**: UI logic completely decoupled from database schema
- **Message-first UX**: Users think "send message", not "create conversation"

### 2.5. Context Menus

**Always use native OS context menus** rather than custom React-based context menu components.

Native context menus provide:
- Consistent look and feel with the operating system
- Proper accessibility support built-in
- Correct positioning and overflow handling
- Native keyboard navigation

Implement context menus via IPC: the renderer sends menu item definitions to the main process, which constructs and displays the menu using Electron's `Menu.buildFromTemplate()` and `menu.popup()` APIs.

### 2.6. Text Selection

**Default to non-selectable UI** to feel like a native desktop application.

The global stylesheet applies `select-none` and `cursor-default` to the `body`. This prevents accidental text selection on buttons, labels, headers, and other UI chrome—matching the behavior of native macOS/Windows apps.

**Opt-in for selectable content:**

Explicitly add `select-text cursor-text` to elements where users need to select and copy text:

- Chat messages (user and AI)
- Composer/input fields (handled by `Input` and `Textarea` components)
- Error messages and toasts (users may need to copy error details)
- Code blocks (already handled by the Markdown component)

### 2.7. UI State Persistence

If a UI state needs to be preserved across sessions, persist it in the renderer using IndexedDB.

## 3. IPC Communication

Three patterns govern all IPC communication. Choose based on direction and response requirements.

### 3.1. One-Way (Renderer to Main)

**When to use:** Fire-and-forget commands where the renderer does not need a response.

**Examples:** Set window title, log analytics, trigger side effects.

**APIs:**
- Preload: `ipcRenderer.send(channel, ...args)`
- Main: `ipcMain.on(channel, handler)`

**Structure:**
```ts
// preload.ts
contextBridge.exposeInMainWorld('api', {
  setTitle: (title: string) => ipcRenderer.send('set-title', title)
})

// main.ts
ipcMain.on('set-title', (_event, title: string) => {
  mainWindow.setTitle(title)
})

// renderer
window.api.setTitle('New Title')
```

### 3.2. Two-Way (Renderer to Main with Response)

**When to use:** Request/response operations where the renderer awaits a result.

**Examples:** Open file dialog, fetch system info, database queries.

**APIs:**
- Preload: `ipcRenderer.invoke(channel, ...args)` (returns Promise)
- Main: `ipcMain.handle(channel, handler)` (returns value or Promise)

**Structure:**
```ts
// preload.ts
contextBridge.exposeInMainWorld('api', {
  openFile: () => ipcRenderer.invoke('dialog:openFile')
})

// main.ts
ipcMain.handle('dialog:openFile', async () => {
  const { filePaths } = await dialog.showOpenDialog({ properties: ['openFile'] })
  return filePaths[0]
})

// renderer
const filePath = await window.api.openFile()
```

### 3.3. Push (Main to Renderer)

**When to use:** Main process initiates communication to push updates or events.

**Examples:** Menu actions, system events, background task completion.

**APIs:**
- Main: `webContents.send(channel, ...args)`
- Preload: `ipcRenderer.on(channel, handler)`

**Structure:**
```ts
// preload.ts
contextBridge.exposeInMainWorld('api', {
  onMenuAction: (callback: (action: string) => void) => {
    ipcRenderer.on('menu:action', (_event, action) => callback(action))
  }
})

// main.ts
const menu = Menu.buildFromTemplate([
  {
    label: 'File',
    submenu: [
      {
        label: 'New',
        click: () => mainWindow.webContents.send('menu:action', 'new')
      }
    ]
  }
])

// renderer
window.api.onMenuAction((action) => {
  console.log('Menu action:', action)
})
```
