# App Development Guidelines

This Electron application uses a main-renderer architecture built with Vite. The main process handles backend concerns—AI integration, IPC, file system—while the renderer process owns UI presentation.

See process-specific guidelines:
- `@src/main/CLAUDE.md` — Main process architecture, three-layer system, logging
- `@src/renderer/CLAUDE.md` — Renderer organization, UI philosophy, components, typography

## IPC Communication

Three patterns based on direction and response requirements:

| Pattern | Direction | API |
|---------|-----------|-----|
| One-way | Renderer → Main | `ipcRenderer.send()` / `ipcMain.on()` |
| Two-way | Renderer → Main with response | `ipcRenderer.invoke()` / `ipcMain.handle()` |
| Push | Main → Renderer | `webContents.send()` / `ipcRenderer.on()` |
