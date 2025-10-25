# `packages/db`

## 1. Overview

The `@arc/db` package is the dedicated data persistence layer for Arc. As a **Module Layer (Lowest)** package, its role is to act as a **Fulfiller** for the business logic in `@arc/core`. It is responsible for defining the database schema, managing migrations, and providing a consistent, low-level database interface. It is built on SQLite and designed to be platform-agnostic, relying on the unified `@arc/platform` package to provide the underlying SQLite driver.

## 2. Core Responsibilities

The responsibilities of `@arc/db` are strictly limited to data infrastructure:

-   **Schema Definition:** Provides TypeScript types for all database entities (e.g., `Chat`, `Message`, `ProviderConnection`).
-   **Migrations:** Contains the complete SQL migration scripts and a runner to bring any database to the current schema version.
-   **Database Abstraction:** Exposes a thin `Database` class that wraps the platform-specific database driver (`PlatformDatabase`) and provides basic methods for executing queries and transactions.

Crucially, `@arc/db` contains **no business logic**. It does not know about repositories, services, or any application-level concepts. Its sole purpose is to manage the database schema and connection.

## 3. Architecture & Dependency Flow

The data layer follows the clean separation of concerns central to Arc's architecture:

```
@arc/core
(Repositories, Business Logic)
      │
      └─ uses ▼
@arc/db
(Schema, Migrations, DB Wrapper)
      │
      └─ uses ▼
@arc/platform
(Platform-Specific DB Driver)
```

1.  The **`@arc/platform` package** (via a subpath, e.g., `@arc/platform/browser`) provides a concrete implementation of the `PlatformDatabase` interface.
2.  The **`@arc/core` package** receives this platform-specific driver during application startup.
3.  `@arc/core` instantiates the `@arc/db/Database` class, passing it the platform driver.
4.  `@arc/core` then runs the migrations using `db.migrate()`.
5.  Finally, `@arc/core` instantiates its own **repositories** (e.g., `ChatRepository`), passing them the initialized `Database` instance.

This ensures that:
-   **Core owns the logic:** All data access patterns and business rules (repositories) live in `@arc/core`.
-   **DB owns the schema:** The schema, migrations, and connection are managed by `@arc/db`.
-   **Platform provides the driver:** The platform-specific implementation details are hidden behind an interface.

## 4. Proposed File Structure

```
packages/db/
  src/
    database.ts       # Thin wrapper
    schema.ts         # TypeScript interfaces for DB tables (Chat, Message, etc.)
    migrations/
      runner.ts       # Executes migrations in sequence
      definitions.ts  # Array of SQL migration scripts (CREATE TABLE, ALTER TABLE, etc.)
    db-errors.ts      # Custom error types for DB operations
```

## 5. Error Handling

The `@arc/db` package surfaces errors related to database integrity, migrations, and connectivity.

- **`DatabaseConnectionError`** (Retry-able on startup only): Thrown if the initial connection to the database file fails.
- **`MigrationError`** (Non-Retry-able): Thrown if a schema migration fails, indicating a corrupt state.
- **`QueryError`** (Non-Retry-able): A general error for failed queries, wrapping the underlying driver's error.

## 6. Database Schema

The schema is designed to be normalized and minimalist, reflecting the principle that a chat is defined by its series of messages. Model and provider selection happens on a per-message basis.

### 6.1. Design Principles

-   **No Empty Chats:** A `chat` row is created atomically within the same transaction as its first `message`. This ensures no chats exist without messages.
-   **Per-Message is Truth:** The `messages` table is the single source of truth for which model and provider were used for any given turn. The `chats` table only stores metadata for the conversation group.
-   **State is Derived:** Dynamic state like "current model" and "last message timestamp" are not stored in the `chats` table. They are derived by querying the `messages` table, which avoids data redundancy and synchronization problems.

### 6.2. Tables

#### `provider_connections`
Stores configured AI provider instances.

```sql
CREATE TABLE provider_connections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider_type TEXT NOT NULL,
  api_key TEXT NOT NULL,
  base_url TEXT,
  custom_headers TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX idx_provider_connections_name ON provider_connections(name);
```

#### `chats`
Stores chat session metadata. It contains no model or provider information.

```sql
CREATE TABLE chats (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

#### `messages`
Stores individual messages, tracking the model and provider used for each one.

```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  model TEXT,
  provider_connection_id TEXT,
  token_count INTEGER,
  parent_message_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_message_id) REFERENCES messages(id) ON DELETE SET NULL
);

CREATE INDEX idx_messages_chat_id_created_at ON messages(chat_id, created_at ASC);
```

#### `message_attachments`
Stores image attachments for messages.

```sql
CREATE TABLE message_attachments (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('image')),
  mime_type TEXT NOT NULL,
  data TEXT NOT NULL, -- Base64-encoded or a path/URL handled by the platform
  created_at INTEGER NOT NULL,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

CREATE INDEX idx_message_attachments_message_id ON message_attachments(message_id);
```

#### `settings`
Stores application settings as key-value pairs.

```sql
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
```

### 6.3. Full-Text Search

To support `core.search.messages()`, an FTS5 virtual table is used.

```sql
CREATE VIRTUAL TABLE messages_fts USING fts5(
  message_id UNINDEXED,
  content,
  tokenize='porter unicode61'
);

-- Triggers to keep the FTS index synchronized with the messages table
CREATE TRIGGER messages_fts_insert AFTER INSERT ON messages BEGIN
  INSERT INTO messages_fts(message_id, content) VALUES (new.id, new.content);
END;

CREATE TRIGGER messages_fts_delete AFTER DELETE ON messages BEGIN
  DELETE FROM messages_fts WHERE message_id = old.id;
END;

CREATE TRIGGER messages_fts_update AFTER UPDATE ON messages BEGIN
  UPDATE messages_fts SET content = new.content WHERE message_id = new.id;
END;
```

## 7. API Design

The `@arc/db` package exposes a minimal, intuitive API for Core to use.

### 7.1. Initialization

A static factory (`create`) is used for initialization because some platform drivers (like `sql.js`) require asynchronous setup that cannot be performed in a standard constructor. This pattern ensures that a `Database` instance is always fully initialized and ready for use.

```typescript
// Core receives platform database, creates a DB instance, and runs migrations
const db = await Database.create(platformDb);
await db.migrate();
```

### 7.2. Reading Data

```typescript
// Get current model by reading the last message
const lastMessage = await db.query(
  'SELECT model, provider_connection_id FROM messages WHERE chat_id = ? ORDER BY created_at DESC LIMIT 1',
  [chatId]
);

// Query single chat
const result = await db.query(
  'SELECT * FROM chats WHERE id = ?',
  [chatId]
);

// List all chats sorted by most recent activity
const chats = await db.query(`
  SELECT 
    c.id,
    c.title,
    c.created_at,
    c.updated_at,
    MAX(m.created_at) as last_message_at
  FROM chats c
  INNER JOIN messages m ON m.chat_id = c.id
  GROUP BY c.id
  ORDER BY last_message_at DESC
`);

// Get all messages in a chat
const messages = await db.query(
  'SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC',
  [chatId]
);
```

### 7.3. Writing Data

```typescript
// Create a chat and its first message in a transaction
await db.transaction(async () => {
  await db.execute(
    'INSERT INTO chats (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)',
    [chat.id, chat.title, chat.createdAt, chat.updatedAt]
  );
  await db.execute(
    'INSERT INTO messages (id, chat_id, role, content, model, provider_connection_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [message.id, message.chatId, message.role, message.content, message.model, message.providerConnectionId, message.createdAt, message.updatedAt]
  );
});

// Update
await db.execute(
  'UPDATE chats SET title = ?, updated_at = ? WHERE id = ?',
  [chat.title, chat.updatedAt, chat.id]
);

// Delete
const result = await db.execute(
  'DELETE FROM chats WHERE id = ?',
  [chatId]
);
// Check result.rowsAffected
```

### 7.4. Transactions

```typescript
// Atomic multi-step operations
await db.transaction(async () => {
  await db.exec('DELETE FROM messages WHERE chat_id = ?', [chatId]);
  await db.exec('DELETE FROM chats WHERE id = ?', [chatId]);
});
```

### 7.5. Bulk Operations

```typescript
// Multi-statement script
await db.executeScript(`
  DELETE FROM messages WHERE chat_id = '123';
  DELETE FROM chats WHERE id = '123';
`);
```

### 7.6. Lifecycle

```typescript
// Startup
const db = await Database.create(platformDb);
await db.migrate();

// Shutdown
await db.close();
```

### 7.5. Design Rationale

**Why `token_count` in messages?**
- Allows for tracking token usage per message for analytics or cost management.
- The value is sourced directly from the AI provider's response. It is nullable because not all providers may return it, and we will not use local tokenization libraries to calculate it.

**Why UUIDs?**
- Platform-agnostic, no autoincrement issues across synced databases
- Safe for distributed systems or future sync features

## 8. Testing Strategy

The testing strategy for `@arc/db` ensures the database schema, migrations, and data access wrapper are robust and reliable. All tests are designed to be fully automated and runnable in any non-interactive environment.

-   **Migration Validation**: Tests will spin up a fresh in-memory SQLite database (`:memory:`) and run the entire migration suite. The schema will then be inspected programmatically to verify that all tables, columns, indexes, and triggers were created correctly.

-   **Idempotency Checks**: The migration runner will be tested to ensure that running migrations multiple times on the same database is a safe, non-destructive operation.

-   **Wrapper Delegation**: The `Database` class will be tested in isolation with a mocked `PlatformDatabase` to confirm that it correctly delegates calls (`query`, `execute`, `transaction`, etc.) to the underlying platform driver.

-   **Transaction Safety**: The `db.transaction()` method will be explicitly tested to ensure it issues a `COMMIT` on success and a `ROLLBACK` when any error is thrown within the transaction block.

-   **Schema Integrity**: Automated tests will verify database constraints, such as foreign key relationships (e.g., `ON DELETE CASCADE`), `CHECK` constraints, and `UNIQUE` indexes.

-   **Automation Requirement**: All tests for this package must be runnable via a single, non-interactive command (e.g., `pnpm test --filter=@arc/db`) that requires no external database server or user input.

### Success Criteria

-   [ ] Migrations apply cleanly to a fresh, empty database.
-   [ ] The final schema matches the design specification exactly.
-   [ ] The `Database` wrapper correctly manages transactions and delegates queries.
-   [ ] All database constraints and triggers behave as expected under test conditions.
-   [ ] All tests pass using an in-memory database without filesystem access.