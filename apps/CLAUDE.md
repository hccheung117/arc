# Architecture

This app follows a client-server architectural pattern:

- **Client**: `apps/web/` (Next.js static export, the UI/renderer)
- **Server**: `apps/desktop/` (Electron, the backend/main process)

They communicate via IPC.

## Separation of Concerns

### Client-Server Boundary Rules

**Client** (`apps/web/` - Next.js renderer):
- Presentation logic and UI components only
- User interactions and event handlers
- Client-side state management (UI state, optimistic updates)
- **NO** network requests (no fetch, no WebSocket, no AI SDK clients)
- **NO** file system access
- **NO** database access
- **NO** API keys or credentials

**Server** (`apps/desktop/` - Electron main process):
- All database operations (SQLite via Drizzle ORM)
- All network I/O (AI provider APIs, external services)
- All file system operations
- Credential and API key management
- Business logic that requires I/O

**Communication**: All cross-boundary communication happens exclusively via IPC contracts defined in `packages/contracts/`.

## App-Specific Documentation

For detailed development guidelines specific to each app, see:

- [Web App Guidelines](./web/CLAUDE.md) - Next.js static export conventions, routing, and UI patterns
- [Desktop App Guidelines](./desktop/CLAUDE.md) - Electron main process, IPC, and database conventions
