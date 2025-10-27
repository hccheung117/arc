# Arc: UI/UX Plan & Information Architecture

## 1. Vision & Philosophy

Arc is a native, privacy-first AI chat client designed to solve the fragmentation and security concerns of today's cloud-based AI landscape. It's built for everyone from students to AI researchers, providing a seamless and powerful experience across multiple models without the complexity of self-hosting or the limitations of a siloed web interface.

Our design philosophy is simple: **"Feels like ChatGPT, works like a power tool."** The UI prioritizes simplicity for new users while making advanced features accessible through progressive disclosure, catering to users at every level of expertise.

### Design Principles

- **Clean UI First, Keyboard-Driven Power:** The interface is clean and beginner-friendly, but backed by comprehensive keyboard shortcuts for advanced users to enable a fast, fluid workflow.
- **Respect the Desktop:** The application embraces native desktop patterns to feel integrated and familiar on each platform.
- **Three-Layer UX:** Interaction is structured in three layers of progressive disclosure:
    - **Always Visible:** Core functionality that everyone needs is always visible and accessible.
    - **Visible on Hover:** Intermediate actions are revealed on hover, keeping the interface clean but discoverable.
    - **Context Menu:** Advanced, power-user actions are available in context menus.

### Guardrails for “Feels like ChatGPT, Works like a Power Tool”

These are non-negotiable principles to gate all design and development decisions. They must be audited in code reviews, tests, and prototypes.

1. **Keyboard-First Interaction**: Every primary action must have a visible keyboard shortcut (e.g., in tooltips). Tab order must be logical and documented in component specs.
2. **Progressive Disclosure**: Explicitly classify controls as always-visible (core), hover-revealed (intermediate), or context menu (advanced). Document per component.
3. **Desktop-Native Feedback**: Ensure <200 ms feedback on hover/press. Use system cursors, OS-native spellcheck, and selection behaviors.

## 2. User Personas & Experience Levels

We segment our users into three levels, each with distinct needs:

### Level 1: Beginners

- **Student:** "I need a simple, free tool to help me with my homework and essays without a complicated setup."
- **Office Professional:** "I need a reliable AI assistant to help me draft emails and reports quickly, but our company has strict security rules."
- **Content Creator:** "I need a versatile tool to brainstorm ideas and generate social media content without juggling multiple AI websites."

### Level 2: Intermediate Professionals

- **Product Manager:** "I need an efficient way to summarize user feedback and draft specs, with more control than the basic web chats offer."
- **Marketing Analyst:** "I need to compare outputs from different AI models to create the most effective campaign copy and analyze market data."

### Level 3: AI Power Users

- **Academic Researcher:** "I need a powerful tool to analyze research papers, process experimental data, and draft manuscripts using multiple specialized AI models."
- **Innovation Lead:** "I need to evaluate different providers and tuning settings to set organizational standards without the complexity of self-hosting."

## 3. Information Architecture

Arc's interface is organized into two primary views: the **Chat View** for all user interaction and the **Settings View** for configuration. This structure separates the core workflow from the setup process, ensuring a clean and focused user experience.

### 3.1. Chat View (`/`)

The main interface is a two-column layout designed for a fluid and intuitive workflow, separating conversation management from the active chat.

**A. Left Column: Chat History & Navigation**

The sidebar is dedicated to managing and navigating conversations. Key features include:
-   **Search Bar:** Quickly filter the chat list by title or content.
-   **Chat List:** A chronologically grouped list of all conversations, with a context menu for essential actions like renaming, duplicating, or deleting chats.

**B. Right Column: The Conversation Canvas**

This is the primary workspace where users interact with the AI, structured into three distinct rows for clarity.
-   **Row 1: Header:** Contains the **Model Selector**, a powerful dropdown that allows users to search, favorite, and switch between AI models for the current conversation.
-   **Row 2: Message Transcript:** A virtualized list displaying the conversation.
    -   **Rich Content:** Full Markdown support, including syntax-highlighted code blocks, Mermaid diagrams, and image galleries.
    -   **Powerful Actions (on hover):** Intermediate actions like **Copy**, **Edit**, **Regenerate**, and **Branch Off** are revealed on hover.
    -   **Workflow Tools:** For power users, features like **In-Chat Search (Cmd+F)** and **Message Pinning** help manage long and complex conversations.
-   **Row 3: Composer:** A rich input component for crafting messages.
    -   An auto-expanding textarea with support for image attachments.
    -   Advanced controls are available in popovers, including **System Prompts** and **Temperature** adjustments, catering to power users without cluttering the interface for beginners.

**C. Global Overlays**

Functionality that spans the entire chat experience is accessible via overlays:
-   **Command Palette (Cmd+K):** A global search interface to find any message across all chats.
-   **Image Lightbox:** A full-screen viewer for attached images.

### 3.2. Settings View (`/settings`)

A dedicated area for configuring the application, AI providers, and appearance, organized with a clear sidebar for navigation.

-   **AI Providers:** The core of Arc's multi-model capability. This section allows users to **add, edit, duplicate, and delete provider configurations**. The "Add Provider" flow features **automatic provider detection** from credentials and a built-in **connection test** to ensure a smooth setup.
-   **Appearance:** Allows users to customize the look and feel of the application, with options for **theme selection (Light, Dark, System)** and **typography adjustments** (font size, line height).
-   **About:** Provides essential application information, including version and build details, and includes a one-click function to **check for updates**.

## 4. Key User Flows

### 4.1. First Time Open

1. User launches Arc for the first time.
2. The app opens to the main Chat Page (`/`).
3. The Content Area displays an empty state with a muted, sunk Arc logo or name.
4. A primary call-to-action (e.g., "Configure Your First AI Provider") is prominently displayed, directing the user to the Settings Page.
5. User navigates to Settings > AI Providers.
6. User follows the "Provider Setup" flow.
7. After successfullyadding a provider, the "Back to Chat" button returns them to `/`.
8. The Model Selector in the header automatically selects the newly added provider/default model.
9. The user can now start their first chat.

### 4.2. Provider Setup

1. From the Settings Page (`/settings`), user clicks the "AI Providers" tab.
2. User clicks the "Add Provider" button.
3. The Provider Form Dialog (modal) opens. The primary action button is labeled "Test".
4. User inputs their credentials (API Key, Base URL, or both).
    - **Note:** All fields are optional to support corporate proxy configurations or partially-set-up providers.
5. As the user types, the system attempts to auto-detect the provider (e.g., "OpenAI format detected"). A status indicator confirms detection.
6. If the credentials are valid for multiple provider types, a manual selection dropdown appears, prompting the user to clarify.
7. User clicks the "Test" button. The system attempts to connect and validate the credentials, showing a loading state.
8. **On Success:** The "Test" button turns into a "Save" button, and a success message is shown.
9. **On Failure:** An inline error message appears explaining the failure (e.g., "Invalid API Key"), and the button remains "Test".
10. User clicks "Save" (after a successful test).
11. The dialog closes, and the new provider appears in the Provider List with a "Connected" status.

### 4.3. Model Selection (New Chat)

1. In the Main Chat Interface (`/`), the user clicks the Model Selector in the header.
2. A dropdown appears, organized by provider. By default, it shows all available models from all providers.
3. The dropdown includes:
    - A **Search Bar** at the top.
    - A **"Star" icon** next to each model (on hover).
    - A **"Filter" button** (e.g., funnel icon).
4. **Favoriting Flow (L2+):** User clicks the "Star" icon next to their most-used models. A "Favorites" group is created at the top of the list for one-click access.
5. **Whitelisting Flow (L2+):** User clicks the "Filter" button. A new view appears where they can check/uncheck models across all providers to whitelist only the ones they want to see. After applying, the dropdown is much cleaner.
6. **Standard Selection Flow:**
    - User types in the search bar (e.g., "cs4").
    - The list (full or whitelisted) filters using fuzzy matching, showing "Claude Sonnet 4.5".
    - User clicks the desired model.
7. The dropdown closes, and the header now displays the selected model. The *current chat* is now set to use this model.

Unless specified, a chat will use a "default" model from the selected provider.

### 4.4. Per-Message Model Change (Context Switching)

1. The user is in an existing conversation with Model A.
2. Before sending their *next* message, the user clicks the Model Selector in the header and selects Model B.
3. The user types and sends their new message.
4. This message (and all subsequent messages in this chat) will be processed by Model B.
5. The message list clearly indicates which model generated which response, and marks the point of the switch.

Example: A subtle "--- Switched to Claude 3 Sonnet ---" divider appears in the chat list.

### 4.5. Branch Off Conversation

1. User is scrolling through an existing chat.
2. User hovers over a specific message (either their own or an AI response).
3. A set of Message Actions appears (on hover).
4. User clicks the "Branch Off" button.
5. A new chat is instantly created in the Chat History Sidebar.
6. This new chat is an exact duplicate of the original conversation *up to and including* the selected message.
7. The user is automatically switched to this new chat, with the composer focused, ready to continue the conversation from that specific point.

### 4.6. Automatic Chat Titling

1. User starts a new chat and sends the first message (e.g., "how do list comprehensions work in python?").
2. The AI model processes the message and sends its response.
3. After this first round-trip, Arc automatically generates a concise title for the chat (e.g., "Python List Comprehensions").
4. This title immediately replaces the "New Chat" placeholder in the Chat History Sidebar.
5. The system may update this title as the conversation evolves (e.g., after a few more rounds) to better reflect the chat's main topic, always prioritizing brevity for sidebar readability.

### 4.7. In-Chat Message Pinning (for L2+ Users)

1. A user is in a long conversation and finds a key message (e.g., an important code snippet or a core idea).
2. On hover, the user selects a "Pin Message" action.
3. A new "Pinned Messages" bar appears at the top of the chat content area (below the header), showing a compact representation of the pinned message (e.g., "Pin 1: Code snippet...").
4. As the user scrolls, this pin bar remains visible.
5. User clicks on a pin in the bar.
6. The main chat view automatically scrolls to that specific message, highlighting it briefly.
7. Simultaneously, a "Scroll back to last position" button or toast appears, allowing the user to one-click return to where they were before clicking the pin.

## 5. Development Phases (Revised)

What Can Actually Be Done (UI-Only with Current Core API)

✅ FEASIBLE (Core API Already Supports)

1.  **Model Selector Enhancement (Partial)**
    -   ✓ Load actual models via `core.providers.getModels(providerId)`
    -   ✓ Display models grouped by provider
    -   ✓ Add fuzzy search (UI-only filtering)
    -   ✗ Favoriting - NO (needs persistence not in Core)
    -   ✗ Whitelisting - NO (needs persistence not in Core)
2.  **Per-Message Model Indicators**
    -   ✓ Messages already include `model` and `providerConnectionId` fields
    -   ✓ Can show dividers/badges showing which model answered
3.  **Settings Completion**
    -   ✓ About page (read `package.json`, display static version info)
    -   ✗ Line height persistence - NO (`core.settings` only supports: `theme`, `defaultModel`, `fontSize` enum, `showTokenCounts`, `enableMarkdown`, `enableSyntaxHighlighting`)
    -   ✗ Font family - NO (not in Settings schema)
4.  **UI Polish**
    -   ✓ Context menus for `Message`/`ChatListItem`
    -   ✓ Keyboard navigation audit
    -   ✓ Animations and transitions
    -   ✓ Better tooltips with keyboard shortcuts

❌ BLOCKED (Requires Package Changes)

-   Provider auto-detection (needs `@arc/ai` logic)
-   Model favoriting (needs Settings schema update)
-   Model whitelisting (needs Settings schema update)
-   Typography settings beyond `fontSize` enum (needs Settings schema)
-   Branch Off (needs Core API method)
-   Auto-titling (needs Core AI integration)
-   Message pinning (needs DB schema)
-   Advanced composer controls (needs Core API)

---

### Revised Realistic Implementation Sequence

#### Phase 1: Model Selector - Load Real Models

**Objective:** Stop hardcoding, show actual available models

1.  Call `core.providers.getModels(providerId)` for each provider
2.  Display models grouped by provider in dropdown
3.  Add fuzzy search filter (client-side)
4.  Handle loading states and errors
5.  Update chat creation to use selected model

**Error Handling:**
-   Distinguish between retry-able (network failure) and non-retryable (invalid API key) errors when fetching models.
-   Show errors as a chat message (as AI message in failure style) with provider context.
-   For retry-able errors, display a "Retry" button that calls the refetch mechanism.
-   Use loading skeletons while models are being fetched to prevent layout shifts.

**Why first:** Biggest current UX gap. Core API already supports this.

---

#### Phase 2: Per-Message Model Indicators

**Objective:** Show which model generated each response

1.  Add visual badges to `Message` component showing `message.model`
2.  Add divider when model changes mid-conversation
3.  Show provider name via `message.providerConnectionId`
4.  Handle missing model info gracefully

**Error Handling:**
-   Gracefully handle missing model or provider metadata in messages without crashing the UI.
-   Display a fallback state (e.g., "Unknown Model") if data is inconsistent.
-   Use tooltips to inform the user if a provider referenced in an old message has since been deleted.

**Why second:** Small polish that adds transparency. Data already exists.

---

#### Phase 3: About Page

**Objective:** Complete settings panel

1.  Add "About" tab to `SettingsSidebar`
2.  Create `About` component (`components/about.tsx`)
3.  Create workspace-root `version.json` as single source of truth
4.  Import version data from `version.json`
5.  Display app name, version, build date
6.  Add "Check for Updates" button (disabled/placeholder for now)

**Error Handling:**
-   Display fallback "Version unavailable" if `version.json` cannot be imported
-   Component never crashes on import failure
-   "Check for Updates" button is disabled with "Coming soon" tooltip

**Why third:** Quick win, independent feature.

---

#### Phase 4: UI Polish & Context Menus

**Objective:** Improve keyboard-first interaction

1.  Add context menus to `Message` (Copy, Edit, Regenerate, Delete, Branch Off\*)
2.  Add context menus to `ChatListItem` (Rename, Duplicate\*, Delete)
3.  Document keyboard shortcuts in all tooltips
4.  Audit and fix tab order across all interactive elements
5.  Add placeholder UI for deferred features (Branch Off shows "Coming Soon")

**Error Handling:**
-   Implement a toast notification system to provide clear feedback for context menu actions (e.g., "Chat renamed successfully," "Failed to delete chat").
-   Support retry-able actions within toasts for transient network errors.
-   Provide clear, non-retryable error messages for validation failures (e.g., "Chat name cannot be empty").
-   Use optimistic UI updates for mutations (e.g., rename) with proper rollback on failure.

**Why fourth:** Foundation polish before final refinements.

---

#### Phase 5: Comprehensive Error Handling & Final Polish

**Objective:** Build a robust, application-wide error handling system and polish all user-facing interactions.

1.  **Global Error Boundary:** Implement a global React Error Boundary to prevent application crashes and display a user-friendly fallback screen.
2.  **Enhanced Toasts:** Enhance the toast notification system to support different error severities, durations, and retry actions.
3.  **Error Classification:** Implement a centralized `classifyError` utility to classify errors from `@arc/core` (`retry-able` vs. `non-retryable`) and generate user-actionable messages.
4.  **Standardized Async Hook:** Create a standardized `useAsyncAction` hook to manage loading, error, and data states for all asynchronous operations, ensuring consistent UI feedback.
5.  **Audit Loading & Error States:** Audit all data-fetching components to ensure they have appropriate loading skeletons and clear, contextual error states.
6.  **Improve Empty States:** Improve all empty states to be more informative and guide the user on next steps.
7.  **Final Polish:** Polish all UI animations, transitions, and micro-interactions for a fluid user experience.

**Why last:** Touches everything, needs all features in place.

---

### Critical Path

```
Phase 1 (model selector) → Phase 2 (model indicators) → Phase 5 (polish)
                               ↓
Phase 3 (about page) → Phase 4 (context menus, keyboard)
```

Phases 3-4 can run in parallel with Phase 1-2.

---

### What Got Cut (Requires Package Changes; will handle at the very end)

These features from the original plan cannot be implemented without touching `packages/`:

-   ❌ **Model favoriting** (needs `core.settings` schema update)
-   ❌ **Model whitelisting** (needs `core.settings` schema update)
-   ❌ **Provider auto-detection** (needs `@arc/ai` provider detection logic)
-   ❌ **Line height settings** (needs `core.settings` schema update)
-   ❌ **Font family settings** (needs `core.settings` schema update)
-   ❌ **Branch Off** (already marked deferred - needs `core.chats.branch()`)
-   ❌ **Auto-titling** (already marked deferred - needs Core AI)
-   ❌ **Pinning** (already marked deferred - needs DB schema)
-   ❌ **System prompts** (already marked deferred - needs Core API)
-   ❌ **Temperature controls** (already marked deferred - needs Core API)

**Bottom line:** The realistic scope without touching packages is much smaller - mostly UI polish and leveraging existing Core APIs (model loading, model indicators, About page, context menus).

## 6. Implementation Guidelines

To ensure a consistent, maintainable, and scalable application, all UI development must adhere to the guiding principles of the Arc architectural philosophy. This section translates that philosophy into concrete technical guidelines for the UI layer.

### 6.1. Architectural Context: The UI as the "Demander"

Arc is built on a **strictly layered architecture** where higher layers demand and lower layers fulfill. The UI (`apps/web`) is the highest layer—it is the ultimate "Demander."

-   **The Three-Layer Model:** The UI's role is to handle user interaction and translate it into demands on the **Headless Core (`@arc/core`)**. The Core then orchestrates lower-level modules (`@arc/ai`, `@arc/db`, `@arc/platform`) to fulfill those demands.
-   **Strict Dependency Flow:** To enforce this, a critical rule is in place: the UI layer is **only** allowed to import from `@arc/core`. Direct access to `@arc/ai`, `@arc/db`, or `@arc/platform` is strictly forbidden and enforced by ESLint. This ensures the UI remains a pure, platform-agnostic consumer of the system's business logic.

### 6.2. Technology Stack & Build Strategy

-   **Technology Stack:**
    -   **UI & Web App:** Next.js 15, shadcn/ui, Tailwind CSS 4
    -   **Desktop Wrapper:** Electron 38
    -   **Mobile Wrapper:** Capacitor 7
    -   **Core Logic Dependency:** Pure TypeScript (ESM) via `@arc/core`
    -   **Monorepo Management:** pnpm & Turborepo
-   **Build Strategy:** Arc uses a **static-first** build strategy. The Next.js app is exported as a static site (`output: 'export'`), removing the need for a Node.js server at runtime. The Electron and Capacitor apps load these static assets directly.

### 6.3. Naming & Import Conventions

Consistency is enforced through strict naming and import conventions. These are not suggestions; they are requirements for all new code.

-   **Files & Folders:** **All kebab-case** (e.g., `chat-service.ts`, `ai-providers/`).
-   **React Components:** Kebab-case filenames (`chat-list-item.tsx`), but PascalCase component names (`export function ChatListItem()`).
-   **React Hooks:** Kebab-case files with a `use-` prefix (`use-provider-detection.ts`).
-   **Tests:** Kebab-case with a `.test` suffix (`chat-service.test.ts`).
-   **No Barrel Imports:** Barrel files (`index.ts`) that re-export modules are strictly forbidden. **Always import directly from the source file.** This is critical for tree-shaking and maintaining a clear dependency graph.

### 6.4. Error Handling Strategy

The UI must align with the project's layered error handling strategy.

-   **Error Propagation:** The UI will receive errors that have been caught and wrapped by `@arc/core` (e.g., `CoreError`). It is the UI's responsibility to interpret these errors and provide clear, user-actionable feedback.
-   **Error Classification:** As noted in Phase 4, full support for retry-able vs. non-retryable errors is deferred, but the UI should be built with this future state in mind, creating components that can handle different error states gracefully (e.g., showing a "Retry" button for a network error vs. a permanent failure message for an invalid API key).