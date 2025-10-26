# `@arc/core`: API and Architecture

## 1. Overview & Architectural Role

`@arc/core` is the **Core Layer (Middle)** of Arc's three-layer architecture. It serves as the headless, platform-agnostic business logic engine for the entire application. It encapsulates all core functionality—including AI provider management, chat state, and data persistence—and exposes a clean, consistent API for its consumer, the **Application Layer** (Web, Desktop, Mobile).

Its primary role is to act as an **Orchestrator**, fulfilling requests from the UI by coordinating the lower-level **Module Layer** packages (`@arc/ai`, `@arc/db`, `@arc/platform`).

This document outlines its guiding architectural principles, public API surface, and internal structure.

## 2. Guiding Principles

The design of `@arc/core` is governed by the following principles:

-   **Consumer-First Design**: The API is designed from the perspective of a UI developer. It must be intuitive, clean, and easy to consume. Usage guides implementation, not the other way around.
-   **Facade Pattern**: The Core exposes a simple, high-level API (`core`) that abstracts away the underlying complexity of provider integration, state management, and data persistence. The Application Layer must *only* interact with this facade.
-   **Platform Injection**: The Core is platform-agnostic. It receives platform-specific implementations (for Database, HTTP, etc.) from `@arc/platform` during initialization. This allows it to remain a portable, headless engine.
-   **Internal Lifecycle Management**: The Core is solely responsible for the complete lifecycle of AI provider instances. It maintains an internal registry of available provider types and manages their instantiation, configuration, and state.

## 3. Core API Surface

Because the initialization of the Core is an asynchronous and complex process (requiring database setup, migrations, etc.), it is handled by a dedicated `createCore` factory function. This ensures that consumers receive a fully configured and ready-to-use instance.

```typescript
// App layer
import { createCore } from '@arc/core';

// The UI layer simply specifies the desired platform type,
// and the Core handles the platform creation internally.
const core = await createCore({ platform: 'browser' });

// Now the core facade is ready to be used
const chats = await core.chats.list();
```

The API is organized by domain into namespaces to provide a clean and intuitive experience for UI developers.

### `core.providers`
*Manages AI provider connections.*

-   `list()`: Get all configured provider instances.
-   `create(config)`: Add a new provider connection.
-   `update(id, config)`: Update an existing provider's settings.
-   `delete(id)`: Remove a provider connection.
-   `checkConnection(id)`: Validate a provider's API key and connection status.

### `core.chats`
*Handles the lifecycle of a chat session.*

-   `create(options)`: **Starts a new chat flow** by returning a `PendingChat` builder. This does **not** write to the database immediately.
-   `get(id)`: Get a single chat with all its messages (for existing chats).
-   `list()`: Retrieve a list of all chat sessions (metadata only).
-   `rename(id, title)`: Rename an existing chat.
-   `delete(id)`: Delete a chat and its associated messages.
-   `sendMessage(id, params)`: Send a message to an **existing** chat and stream the response.

### `PendingChat` Builder
*A temporary object representing a chat that has not yet been persisted.*

-   `send(params)`: **Sends the first message.** This performs the actual database write, creating the chat and its first message in a single atomic transaction.

### `core.messages`
*Manages individual messages within an existing chat.*

-   `regenerate(chatId)`: Regenerate the last response in a chat.
-   `edit(messageId, content)`: Edit a user's message and regenerate the conversation from that point.
-   `delete(messageId)`: Delete a single message.
-   `stop()`: Stop any in-progress response generation.

### `core.search`
*Provides full-text search capabilities.*

-   `messages(query)`: Search across all messages in all chats.
-   `chats(query)`: (Future) Search by chat title.

### `core.settings`
*Manages user preferences.*

-   `get()`: Retrieve user settings.
-   `update(newSettings)`: Update and persist user settings.

### Usage Example

The namespaced API design promotes a clean, grouped, and discoverable structure.

```typescript
// 1. Start a new chat flow (no DB write yet)
const pendingChat = core.chats.create({ title: 'My New Chat' });

// 2. Send the first message, which persists the chat
const { stream } = await pendingChat.send({
  content: 'Hello, world!',
  model: 'gpt-4',
  providerConnectionId: 'openai-123'
});

// 3. Continue the conversation using the permanent ID
await core.chats.sendMessage(pendingChat.id, {
  content: 'Tell me more.',
  model: 'claude-3.5-sonnet',
  providerConnectionId: 'anthropic-456'
});
```

## 4. Internal Architecture

The internal structure of `@arc/core` is designed to enforce the guiding principles of encapsulation and separation of concerns.

### Facade and Encapsulation

-   **Single Entry Point**: The entire public API is exposed through a single facade object created in `packages/core/src/core.ts`.
-   **Strict Exports**: The `package.json` for `@arc/core` only exports the main facade. All internal modules, such as repositories or domain entities, are not directly accessible to consumers, enforcing the facade pattern at the package level.

### Feature-Sliced Structure

The source code is organized by feature, where each feature namespace in the API corresponds to a directory. This keeps related logic cohesive and self-contained.

Each feature slice typically includes:
-   An **API file** (`*-api.ts`) that defines the public-facing methods for that feature.
-   **Internal modules** like repositories for data access, services for business logic, and domain entities (`*.ts`).

```
packages/core/src/
├── core.ts                    # Main facade entry point, assembles all APIs
│
├── providers/
│   ├── providers-api.ts       # Public API: list(), create(), update(), etc.
│   ├── provider-registry.ts   # Internal: Manages available provider types
│   └── provider-manager.ts    # Internal: Lifecycle management
│
├── chats/
│   ├── chats-api.ts           # Public API: list(), get(), create(), etc.
│   ├── chat-repository.ts     # Internal: Data access logic
│   └── chat.ts                # Internal: Domain entity
│
├── messages/
│   ├── messages-api.ts        # Public API: send(), regenerate(), etc.
│   ├── message-repository.ts  # Internal: Data access logic
│   └── message-streamer.ts    # Internal: Handles response streaming
│
├── search/
│   ├── search-api.ts          # Public API: messages(), chats()
│   └── search-engine.ts       # Internal: Full-text search logic
│
├── settings/
│   ├── settings-api.ts        # Public API: get(), update()
│   └── settings-repository.ts # Internal: Data access logic
│
└── shared/
    ├── errors.ts              # Shared error types
    └── id-generator.ts        # Shared utilities
```

## 5. Testing Strategy

The testing strategy for `@arc/core` validates the business logic and orchestration, ensuring all features work correctly with mocked Module Layer dependencies. This isolates the core logic from I/O details, allowing for fast, deterministic, and fully automated testing.

-   **Per-Feature API Tests**: Each public API namespace (`providers`, `chats`, `messages`, etc.) will be tested in isolation. All external dependencies—repositories, AI providers, and platform services—will be mocked to verify that the API layer correctly orchestrates them.

-   **Repository Contract Tests**: All repository implementations (both in-memory and SQLite) must pass an identical suite of contract tests.
    -   SQLite repositories will be tested against a live, in-memory SQLite database.
    -   In-memory repositories will be used to test the API layers without needing a database instance.

-   **Facade Assembly**: The `createCore` factory will be tested to ensure it correctly initializes and wires together all internal components (APIs, repositories, managers) and exposes the final, unified `core` object.

-   **Cross-Feature Integration**: Key flows that span multiple features will be tested, such as the `PendingChat.send()` method, to ensure they perform their operations atomically (e.g., creating a `chat` and its first `message` in a single transaction).

-   **Automation Requirement**: All tests must be runnable via a single, non-interactive command (e.g., `pnpm test --filter=@arc/core`) and must not perform any real I/O (network, filesystem).

### Success Criteria

-   [ ] Each feature API (`providers-api`, `chats-api`, etc.) is fully tested and behaves as documented, using mocked dependencies.
-   [ ] Both in-memory and SQLite repositories pass the same set of CRUD and query contract tests.
-   [ ] The `createCore` factory successfully assembles the facade with all namespaces and dependencies correctly injected.
-   [ ] Atomic operations, like creating the first message in a new chat, are verified to be transactional.
-   [ ] All tests run to completion without requiring any real platform, database, or AI provider services.
