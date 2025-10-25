# Platform Layer: A Unified `@arc/platform` Package

## 1. Executive Summary

This document outlines the plan to refactor the existing platform-specific packages (`@arc/platform-browser`, `@arc/platform-electron`, `@arc/platform-capacitor`) into a single, unified `@arc/platform` package. This consolidation will simplify dependency management, clarify the architecture, and enforce a clean separation of concerns between the headless core and platform-specific I/O implementations. As the **Ultimate Fulfiller** in the architecture, this package provides the concrete I/O implementations for all higher-level layers.

## 2. Design Principles

The new package will adhere to the following principles:

-   **Foundational Module Layer**: As the lowest-level package, `@arc/platform` serves as the foundational **Module Layer**. It has no dependencies on other `@arc/` packages and exists solely to fulfill I/O requests for `@arc/core`, `@arc/ai`, and `@arc/db`.
-   **Contract-First:** The `@arc/platform` package will define and own its own I/O contracts (e.g., `PlatformDatabase`, `PlatformHTTP`). Higher-level packages (`@arc/core`, `@arc/ai`, `@arc/db`) will depend only on these contracts, not the specific implementations.
-   **Strict Encapsulation:** Platform-specific dependencies and APIs (e.g., Node.js `fs`, `better-sqlite3`, Capacitor plugins) will be completely isolated within their respective modules and will not leak into higher layers.
-   **Simplified Consumption:** A central factory will provide the correct platform implementation at runtime, allowing the core layer to remain unaware of the underlying environment.

## 3. Implementation Strategy

### A. Unified Package Structure

All platform code will be consolidated into a single package. Platform-agnostic contracts are defined at the top level of `src/`, with platform-specific implementations organized into subdirectories.

```
packages/platform/
├─ package.json
└─ src/
   ├─ database.ts            # Defines the PlatformDatabase contract
   ├─ http.ts                # Defines the PlatformHTTP contract
   ├─ filesystem.ts          # Defines the PlatformFilesystem contract
   ├─ factory.ts             # create-platform() factory
   ├─ errors.ts              # Defines the base PlatformError contract
   |
   ├─ browser/
   │  ├─ browser-database.ts    # Implements PlatformDatabase using sql.js
   │  ├─ browser-http.ts        # Implements PlatformHTTP using fetch
   │  └─ browser-platform.ts    # Exports createBrowserPlatform()
   │
   ├─ electron/
   │  ├─ electron-database.ts   # Implements PlatformDatabase using better-sqlite3
   │  ├─ electron-filesystem.ts # Implements PlatformFilesystem using Node fs
   │  └─ electron-platform.ts   # Exports createElectronPlatform()
   │
   └─ capacitor/
      ├─ capacitor-database.ts   # Implements PlatformDatabase via Capacitor plugin
      ├─ capacitor-filesystem.ts # Implements PlatformFilesystem via Capacitor plugin
      └─ capacitor-platform.ts   # Exports createCapacitorPlatform()
```

### B. Dynamic, Lazy Loading

To prevent bundling platform-specific dependencies in the wrong environment (e.g., including Node.js modules in a browser build), implementations will be loaded dynamically. The `createPlatform` factory will accept a platform identifier (e.g., 'browser', 'electron') and dynamically `import()` the correct module. This explicit approach makes platform resolution deterministic and improves testability.

This approach is critical for compatibility with Next.js and ensures a minimal bundle size for each platform.

## 4. Platform-Specific Implementations

The package will provide the following implementations for the core I/O contracts:

### Browser Platform

-   **Database:** `sql.js` (WASM-based SQLite).
-   **HTTP:** Native `fetch` API.
-   **Filesystem:** Limited support (OPFS in Chrome/Edge only, not Firefox/Safari).
                    Not recommended for cross-browser apps without fallbacks.

### Electron Platform

-   **Database:** `better-sqlite3` for native performance.
-   **HTTP:** Native `fetch` API (can reuse the browser implementation).
-   **Filesystem:** Node.js `fs/promises` API for direct file access.

### Capacitor Platform

-   **Database:** `@capacitor-community/sqlite` plugin for native database access on mobile.
-   **HTTP:** Native `fetch` API (can reuse the browser implementation).
-   **Filesystem:** `@capacitor/filesystem` plugin for mobile file I/O.

## 5. Proposed APIs

The following demonstrates the anticipated API surface that the `@arc/platform` package will expose to its consumers (`@arc/core`, `@arc/db`, `@arc/ai`).

### Database APIs

```javascript
// Initialize
platform.database.open(dbPath)
platform.database.close()

// Queries
platform.database.execute(sql, params)
platform.database.executeScript(sql)
platform.database.query(sql, params)
platform.database.get(sql, params)
platform.database.all(sql, params)

// Transactions
platform.database.beginTransaction()
platform.database.commit()
platform.database.rollback()

// Prepared statements
platform.database.prepare(sql)
stmt.run(params)
stmt.get(params)
stmt.all(params)
stmt.finalize()
```

### HTTP APIs

```javascript
// Basic requests
platform.http.get(url, options)
platform.http.post(url, body, options)
platform.http.put(url, body, options)
platform.http.delete(url, options)

// Streaming
platform.http.stream(url, options)
stream.getReader()
reader.read()

// Request configuration
platform.http.request(url, { method, headers, body, signal })
```

### Filesystem APIs

```javascript
// File operations
platform.filesystem.readFile(path)
platform.filesystem.writeFile(path, data)
platform.filesystem.appendFile(path, data)
platform.filesystem.deleteFile(path)
platform.filesystem.exists(path)

// Directory operations
platform.filesystem.readDir(path)
platform.filesystem.createDir(path)
platform.filesystem.deleteDir(path)

// Metadata
platform.filesystem.stat(path)
platform.filesystem.getSize(path)
```

### Factory API

```javascript
// The main factory accepts a platform identifier
createPlatform('browser' | 'electron' | 'capacitor')

// Convenience wrappers for each platform can also be exposed
createBrowserPlatform()
createElectronPlatform()
createCapacitorPlatform()
```

## 6. Error Handling

As the lowest layer, `@arc/platform` is responsible for throwing low-level, technical errors that originate from I/O operations. These errors are not intended to be handled directly by the UI, but rather to be caught and wrapped by the consuming layers (`@arc/db`, `@arc/ai`, `@arc/core`) to provide higher-level business context.

- **`NetworkError`**: Wraps native `fetch` errors, timeouts, or other HTTP client failures.
- **`DatabaseDriverError`**: Wraps errors from the underlying database driver (e.g., `better-sqlite3`, `sql.js`).
- **`FileSystemError`**: Wraps errors from the Node.js `fs` module or Capacitor filesystem plugin.

## 7. Testing Strategy

The testing strategy for `@arc/platform` focuses on ensuring each platform-specific implementation behaves identically and adheres to the defined contracts. All tests must be runnable in a non-interactive, automated environment (e.g., a GitHub Action or any CI environment).

-   **Contract Compliance Tests**: Each platform implementation (browser, electron, capacitor) must pass the same suite of interface contract tests. This guarantees that `platform.database.execute()` behaves the same way regardless of the underlying driver.

-   **Platform Isolation & Automation**: Tests will run in a pure Node.js environment to ensure full automation.
    -   **Browser**: The `sql.js` (WASM) implementation will be tested directly within Node.js.
    -   **Electron**: The `better-sqlite3` implementation will be tested in Node.js (no GUI required).
    -   **Capacitor**: Native Capacitor plugins will be mocked, as they cannot run in a non-interactive environment. The tests will validate the JS-to-native bridge calls.

-   **Factory Validation**: The `createPlatform` factory will be tested to ensure its dynamic `import()` statements correctly load the specified platform module without bundling the others.

-   **Automation Requirement**: All tests for this package must be runnable via a single, non-interactive command (e.g., `pnpm test --filter=@arc/platform`) that returns a clear pass/fail exit code.

### Success Criteria

-   [ ] All platform implementations (browser, electron, mocked capacitor) pass the full contract test suite.
-   [ ] The factory correctly loads modules and throws an error for invalid identifiers.
-   [ ] Tests run to completion without any interactive prompts or external dependencies (like a browser window).
-   [ ] No platform-specific code (e.g., Node.js `fs`) leaks into another platform's bundle.