# @arc/platform

> Unified platform layer providing I/O implementations for Arc across browser, Electron, and Capacitor environments.

## Overview

`@arc/platform` is the foundational **Module Layer** package that provides concrete I/O implementations for database, HTTP, and filesystem operations. It consolidates what were previously three separate packages (`@arc/platform-browser`, `@arc/platform-electron`, `@arc/platform-capacitor`) into a single, unified package with dynamic imports for optimal tree-shaking and bundle size.

## Architecture

### Design Principles

- **Foundational Layer**: The lowest-level package with no dependencies on other `@arc/` packages
- **Contract-First**: Defines and owns its own I/O contracts (interfaces)
- **Strict Encapsulation**: Platform-specific dependencies are completely isolated
- **Dynamic Loading**: Uses dynamic imports to prevent cross-platform code bundling

### Platform Implementations

| Platform | Database | HTTP | Filesystem |
|----------|----------|------|------------|
| **Browser** | sql.js (WASM SQLite) + IndexedDB | Native fetch | Limited (file picker only) |
| **Electron** | better-sqlite3 (native) | Native fetch | IPC-based file operations |
| **Capacitor** | Stubbed (TODO) | Native fetch | Stubbed (TODO) |

## Installation

This package is part of the Arc monorepo and installed via pnpm workspace:

```bash
pnpm install
```

## Usage

### Basic Usage

```typescript
import { createPlatform } from '@arc/platform/platform.js';

// Create a platform instance (dynamically loaded)
const platform = await createPlatform('browser', {
  database: {
    storageKey: 'my-app-db',
    wasmPath: '/vendor/sql-wasm.wasm'
  }
});

// Initialize the database
await platform.database.init();

// Execute queries
const result = await platform.database.query(
  'SELECT * FROM users WHERE id = ?',
  [1]
);

// Make HTTP requests
const response = await platform.http.request('https://api.example.com/data', {
  method: 'GET',
  headers: { 'Content-Type': 'application/json' }
});

// Close database when done
await platform.database.close();
```

### Convenience Functions

```typescript
import {
  createBrowserPlatform,
  createElectronPlatform,
  createCapacitorPlatform
} from '@arc/platform/platform.js';

// Browser platform
const browserPlatform = await createBrowserPlatform({
  database: { storageKey: 'app-db' }
});

// Electron platform
const electronPlatform = await createElectronPlatform({
  database: { filePath: '/path/to/app.db', enableWAL: true }
});

// Capacitor platform (stub)
const capacitorPlatform = await createCapacitorPlatform();
```

### Platform-Specific Examples

#### Browser Platform

```typescript
import { createBrowserPlatform } from '@arc/platform';

const platform = await createBrowserPlatform({
  database: {
    // Path to sql-wasm.wasm file
    wasmPath: '/vendor/sql-wasm.wasm',
    // IndexedDB storage key
    storageKey: 'my-app.db',
    // Debounce duration for writes (ms)
    persistDebounceMs: 500
  },
  http: {
    maxRetries: 3,
    initialDelayMs: 1000
  }
});
```

#### Electron Platform

```typescript
import { createElectronPlatform } from '@arc/platform';

const platform = await createElectronPlatform({
  database: {
    // Path to SQLite file (use ":memory:" for in-memory)
    filePath: '/path/to/database.db',
    // Enable WAL mode for better concurrency
    enableWAL: true
  }
});

// Filesystem operations (requires Electron IPC setup)
const files = await platform.filesystem.pickImages({ multiple: true });
const storagePath = await platform.filesystem.saveAttachment(
  'attachment-id',
  'chat-id',
  'image.png',
  'image/png',
  base64Data
);
```

## API Reference

### Factory Functions

#### `createPlatform(type, options)`

Main factory function that dynamically loads the correct platform implementation.

**Parameters:**
- `type`: `'browser' | 'electron' | 'capacitor'`
- `options`: Platform-specific configuration options

**Returns:** `Promise<Platform>`

### Platform Interface

```typescript
interface Platform {
  type: 'browser' | 'electron' | 'capacitor';
  database: IPlatformDatabase;
  http: IPlatformHTTP;
  filesystem: IPlatformFileSystem;
}
```

### Database API (`IPlatformDatabase`)

```typescript
// Initialize database
await platform.database.init();

// Execute query (SELECT)
const result = await platform.database.query<{ id: number; name: string }>(
  'SELECT * FROM users WHERE id = ?',
  [userId]
);

// Execute mutation (INSERT/UPDATE/DELETE)
const execResult = await platform.database.exec(
  'INSERT INTO users (name) VALUES (?)',
  ['Alice']
);
console.log(execResult.rowsAffected); // 1

// Execute multi-statement script
await platform.database.execScript(`
  CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT);
  INSERT INTO users (name) VALUES ('Alice'), ('Bob');
`);

// Run transaction
await platform.database.transaction(async () => {
  await platform.database.exec('UPDATE accounts SET balance = balance - ?', [100]);
  await platform.database.exec('UPDATE accounts SET balance = balance + ?', [100]);
});

// Close database
await platform.database.close();
```

### HTTP API (`IPlatformHTTP`)

```typescript
// Standard request
const response = await platform.http.request('https://api.example.com/data', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ key: 'value' }),
  signal: abortController.signal
});

// SSE streaming
for await (const chunk of platform.http.stream('https://api.example.com/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt: 'Hello' })
})) {
  console.log('Received:', chunk);
}
```

### Filesystem API (`IPlatformFileSystem`)

```typescript
// Pick images (Electron/Browser with file input)
const files = await platform.filesystem.pickImages({ multiple: true });
console.log(files[0].name, files[0].size, files[0].data);

// Save attachment (Electron only)
const storagePath = await platform.filesystem.saveAttachment(
  'attachment-id',
  'chat-id',
  'document.pdf',
  'application/pdf',
  base64Data
);

// Load attachment (Electron only)
const data = await platform.filesystem.loadAttachment(storagePath);

// Delete attachment (Electron only)
await platform.filesystem.deleteAttachment(storagePath);

// Delete all attachments for a chat (Electron only)
await platform.filesystem.deleteAttachmentsForChat('chat-id');
```

## Error Handling

All platform implementations throw typed errors:

```typescript
import {
  PlatformError,
  DatabaseDriverError,
  NetworkError,
  FileSystemError
} from '@arc/platform';

try {
  await platform.database.query('SELECT * FROM users');
} catch (error) {
  if (error instanceof DatabaseDriverError) {
    console.error('Database error:', error.message, error.sql);
  } else if (error instanceof NetworkError) {
    console.error('Network error:', error.message, error.url);
  } else if (error instanceof FileSystemError) {
    console.error('File system error:', error.message, error.path);
  }
}
```

## Testing

The package includes comprehensive test coverage:

```bash
# Run all tests
pnpm test:run

# Run tests in watch mode
pnpm test

# Type checking
pnpm check-types

# Build
pnpm build
```

### Test Structure

- **Contract compliance tests**: Ensure all platforms implement the same interface correctly
- **Factory validation tests**: Verify dynamic imports and platform selection
- **Platform isolation tests**: Confirm no cross-platform bundling

## Development

### Adding a New Platform

1. Create platform directory: `src/newplatform/`
2. Implement database, HTTP, and filesystem modules
3. Create platform factory: `src/newplatform/newplatform-platform.ts`
4. Add to main factory: `src/factory.ts`
5. Add tests: `src/__tests__/newplatform.test.ts`
6. Run contract compliance tests

### Architecture Notes

- **No barrel imports**: Always import from source files. Package entry point is named `platform.ts`, not `index.ts`
- **Dynamic imports**: Use `import()` for platform-specific code to enable tree-shaking
- **Contract ownership**: This package owns all platform contracts (no dependencies on `@arc/contracts`)

## Migration from Old Packages

If you're migrating from the old separate packages:

### Before
```typescript
import { SqlJsDatabase } from '@arc/platform-browser/database/SqlJsDatabase.js';
import { BrowserFetch } from '@arc/platform-browser/http/BrowserFetch.js';

const db = new SqlJsDatabase();
const http = new BrowserFetch();
```

### After
```typescript
import { createBrowserPlatform } from '@arc/platform';

const platform = await createBrowserPlatform();
// platform.database and platform.http are ready to use
```

## Future Work

- **Capacitor Implementation**: Implement full Capacitor support using:
  - `@capacitor-community/sqlite` for database
  - `@capacitor/filesystem` for file operations
- **Browser Filesystem**: Add IndexedDB-based attachment storage for browsers
- **Additional Platforms**: Support for React Native, Tauri, or other platforms

## License

Private - Part of Arc monorepo
