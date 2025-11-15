# Architecture

This app follows a client-server architectural pattern:

- **Client**: `apps/web/` (Next.js static export, the UI/renderer)
- **Server**: `apps/desktop/` (Electron, the backend/main process)

They communicate via IPC.

## Separation of Concerns

- **All I/O stays in the main process** (e.g., remote AI, local DB)
- **All UI concerns stay in the renderer**

## App-Specific Documentation

For detailed development guidelines specific to each app, see:

- [Web App Guidelines](./web/CLAUDE.md) - Next.js static export conventions, routing, and UI patterns
- [Desktop App Guidelines](./desktop/CLAUDE.md) - Electron main process, IPC, and database conventions
