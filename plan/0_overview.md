# Arc: Architectural & Coding Guidelines

This document is the first in a multi-part series outlining the architectural refactoring of Arc.

-   **Part 0: Overview (this document)**
-   [Part 1: Preparation & File Action Plan](./1_preparation.md)
-   [Part 2: The Platform Layer (`@arc/platform`)](./2_platform.md)
-   [Part 3: The DB Layer (`@arc/db`)](./3_db.md)
-   [Part 4: The AI Layer (`@arc/ai`)](./4_ai.md)
-   [Part 5: The Core Layer (`@arc/core`)](./5_core.md)
-   [Part 6: The UI Layer (`apps/web`)](./6_ui.md)
-   [Part 7: Integration Testing](./7_integration.md)

## 1. Overview

This proposal outlines a new top-level architecture for Arc, designed to enhance clarity, maintainability, and scalability. We are undertaking a **strategic refactoring**—preserving our high-quality business logic while migrating the codebase to a cleaner, layered architecture.

The goal is a strictly layered model where dependencies flow inwards towards a central, headless `@arc/core` package. This guide is intentionally high-level and consumer-centric, focusing on desired usage patterns to guide AI-driven implementation.

## 2. Core Principles

Two principles form the foundation of our architecture.

### 2.1. Consumer-First Design

> **The design of any layer or package must be guided by the experience of its consumer.**
>
> -   When designing `@arc/core`, think as a **UI layer developer**.
> -   When designing `@arc/ai`, think as a **`core` layer developer**.
>
> We must prioritize creating elegant, handy APIs. **Usage guides implementation**, not the other way around.

### 2.2. A Strictly Layered Architecture

The new architecture is organized into three distinct layers. Dependencies must always point inwards, from a higher layer to a lower one. A lower-level module must **never** import from a higher-level one.

1.  **Application Layer (Highest):** The user-facing applications (`web`, `desktop`, `mobile`).
2.  **Core Layer (Middle):** The headless business logic backend (`@arc/core`).
3.  **Module Layer (Lowest):** Specialized packages (`@arc/ai`, `@arc/db`, `@arc/platform`).

This structure is governed by a simple relationship: **"Higher layers demand, lower layers fulfill."** Upper layers act as consumers with specific requirements, and lower layers exist to satisfy them. In practice, this is achieved via dependency injection:

1.  The **Application Layer** knows its environment and imports the correct platform modules.
2.  It provides these platform-specific implementations when initializing the **Core Layer**.
3.  The **Core Layer** operates on interfaces, unaware of the specific platform, ensuring it remains a portable, headless engine.

**Dependency Flow:** `Apps (UI) -> Core (Services/Facade) -> Modules (AI, DB, Platform)`

-   `apps` → `@arc/core`
-   `@arc/core` → `@arc/ai`, `@arc/db`, `@arc/platform`
-   `@arc/ai` → `@arc/platform`
-   `@arc/db` → `@arc/platform`

## 3. Architectural Deep Dive

Each layer and package has a distinct role.

### 3.1. Application Layer (`apps/*`)

-   **Role:** Provides the UI and handles user interaction. Its primary responsibility is to initialize the Core layer with the correct platform-specific implementations (e.g., the `web` app tells `core` to use the `browser` platform).

### 3.2. Core Layer (`@arc/core`)

-   **Role:** Acts as a headless facade, encapsulating all business logic, state management, and orchestration. It is the single entry point for the Application Layer.
-   **API:** Exposes a clean, namespaced API (e.g., `core.chats`, `core.providers`).
-   **Initialization:** Initialized via an async factory. The UI layer provides platform metadata (e.g., `'browser'` or `'electron'`), and Core handles the platform creation internally: `createCore({ platform: 'browser' })`.

### 3.3. Module Layer (`@arc/ai`, `@arc/db`, `@arc/platform`)

This layer provides specialized, decoupled functionalities. These modules are completely decoupled from the Application layer and must not depend on the `core` layer's services.

#### `@arc/platform`

-   **Role:** Consolidates all platform-specific I/O implementations (Database, HTTP, Filesystem) into a single package, replacing the separate `platform-*` packages.
-   **Architecture:** It defines platform-agnostic contracts and uses dynamic, lazy imports to provide the correct implementation at runtime, preventing bundling of server-side code (like `fs`) in the browser.
-   **Initialization:** Loaded via an async factory: `createPlatform('browser')`.

#### `@arc/db`

-   **Role:** Manages the SQLite database schema and migrations. It contains **no business logic** and acts as a thin wrapper around the database driver provided by `@arc/platform`.
-   **Architecture:** Defines TypeScript types for database entities. All business logic (repositories) resides in `@arc/core`.
-   **Initialization:** Requires an async factory to handle driver setup (e.g., loading WASM for `sql.js`): `Database.create(platformDb)`.

#### `@arc/ai`

-   **Role:** Provides a unified, fluent API for interacting with various AI providers.
-   **Architecture:** The API is designed for a chainable, readable chat experience (e.g., `ai.chat.model(...).userSays(...).stream()`).
-   **Initialization:** A stateless client wrapper that uses a simple, synchronous constructor: `new AI(...)`.

### 3.4. Contract Ownership

The centralized `@arc/contracts` package is eliminated. A central contracts package creates implicit coupling and blurs ownership.

Instead, **each low-level module defines and owns its own contracts**. For example, the `Provider` interface will be defined in `@arc/ai`. The `@arc/core` layer will then import these contracts, ensuring a clear, one-way dependency flow.

## 4. Development & Coding Conventions

To complement the architecture, we enforce the following conventions for consistency and readability.

### 4.1. API Design Patterns

We use a requirement-driven approach to API instantiation:
-   **Use async factories (`create...`)** when initialization is async (I/O, WASM loading) or complex. This pattern enforces correct setup.
-   **Use constructors (`new ...`)** when initialization is synchronous and straightforward.

**Examples:**
-   `@arc/platform`: `createPlatform()` (async, dynamic, internal to Core)
-   `@arc/core`: `createCore({ platform: 'browser' })` (async, UI-facing)
-   `@arc/db`: `Database.create()` (async, mandatory)
-   `@arc/ai`: `new AI()` (sync, simple)

### 4.2. Import & Module Rules

-   **No Barrel Imports:** Barrel files (`index.ts`) that re-export modules are strictly forbidden. They break tree-shaking and obscure the dependency graph. **Always import directly from the source file.** Package entry points are allowed but must not be named `index.ts` - use descriptive names like `platform.ts`, `core.ts`, etc.

### 4.3. Naming Conventions

-   **Files & Folders:** **All kebab-case** (e.g., `chat-service.ts`, `ai-providers/`).
    -   Avoid generic names like `types.ts`; be descriptive (e.g., `openai-errors.ts`).
-   **Type-Only Files:** Use a `.type.ts` suffix for any module that *only* exports types or interfaces (e.g., `ai.type.ts`).
-   **Interfaces/Contracts:** No `I` prefix. Define in descriptive, kebab-case `.type.ts` files (e.g., `ai.type.ts` exports `interface AI`).
-   **Implementations:** Use specific, kebab-case filenames *without* the `.type` suffix (e.g., `openai.ts` exports `class OpenAI implements AI`).
-   **React Components:** Kebab-case filenames (`chat-list-item.tsx`), but PascalCase component names (`export function ChatListItem()`).
-   **React Hooks:** Kebab-case files with a `use-` prefix (`use-provider-detection.ts`).
-   **Tests:** Kebab-case with a `.test` suffix (`chat-service.test.ts`).

### 4.4. Enforcement

Architectural boundaries and naming conventions will be enforced automatically wherever possible.
-   **ESLint Import Restrictions:**
    -   The UI Layer (`apps/*`) is only allowed to import from `@arc/core`.
    -   Direct UI access to `@arc/ai`, `@arc/db`, or `@arc/platform` will be disallowed and enforced via linting.
    -   Barrel imports will be banned.
-   **ESLint Filename Rules:** An ESLint plugin will enforce kebab-case for all new files.
-   **Gradual Adoption:** These rules will apply to all new code. Existing code will be refactored gradually.

### 4.5. Error Handling Strategy

A robust error handling strategy is essential for clarity, resilience, and a good user experience. Our approach is based on a layered model of error propagation and classification.

#### Error Propagation Flow

Errors are handled at the boundary of each architectural layer. A lower layer may throw a technical error, which is then caught and wrapped by the consuming higher layer to add meaningful business context.

```
Platform Layer (throws PlatformError)
       ↓
Database/AI Layer (catches, wraps as DatabaseError/AIError)
       ↓
Core Layer (catches, wraps as CoreError or rethrows)
       ↓
Application Layer (catches, displays to user)
```

#### Error Classification

Errors are classified to enable intelligent recovery mechanisms like automatic retries.

-   **Retry-able Errors:** Transient failures (e.g., network timeouts, provider rate limits) that can be safely retried, often with an exponential backoff strategy.
-   **Non-Retry-able Errors:** Permanent failures (e.g., invalid API keys, validation errors) that should fail immediately and provide clear feedback to the user.

## 5. Testing Mindset

This refactoring is guided by a test-driven mindset designed for a fully automated, AI-agent-led process. We assume the existing codebase and its tests are broken and will be replaced.

-   **Package-First Isolation**: Each package (`@arc/platform`, `@arc/db`, `@arc/ai`, `@arc/core`) will be tested in complete isolation. Dependencies on other `@arc/` packages will be mocked, ensuring a package's functionality can be proven without relying on other evolving parts of the system.

-   **Bottom-Up Validation**: Testing proceeds from the lowest architectural layer upwards. The `@arc/platform` layer will be validated first, followed by `@arc/db` and `@arc/ai`, and finally `@arc/core`. A layer must pass its own isolated tests before it can be used as a dependency for the layer above it.

-   **Fully Automated & Non-Interactive**: All tests will be designed to run non-interactively in a CI/CD environment. There will be no reliance on GUIs, browser windows, or manual steps. This ensures that an AI agent can run the entire test suite autonomously.

-   **Integration Last**: Full end-to-end integration tests, where the real packages are wired together, will only be performed after all individual packages have been refactored and have passed their own comprehensive, isolated test suites.