# App Development Guidelines

This Electron application uses a main-renderer architecture built with Vite. The main process handles backend concerns—AI integration, IPC, file system—while the renderer process owns UI presentation.

## Core Mental Model: Commands as Data

**The trigger is incidental. The domain is essential.**

For example, a "delete thread" operation is the same whether triggered by button click, context menu, or keyboard shortcut. All user intents become Commands that flow through a single domain handler.

```
Any Trigger → Command → Domain Handler → Effect { result, events[] } → Broadcast → UI State
```

**Key principles:**

1. **Domain-centric split** — Group by what (e.g., threads, profiles, ai), not by how (e.g., IPC, menu, keyboard)
2. **Single source of truth** — Each domain has one command handler that decides all events
3. **Effects as data** — Domain returns `{ result, events }`, caller broadcasts
4. **Unidirectional flow** — Commands down, events up. No scattered side effects.

## IPC Communication

Three patterns based on direction and response requirements:

| Pattern | Direction | API |
|---------|-----------|-----|
| One-way | Renderer → Main | `ipcRenderer.send()` / `ipcMain.on()` |
| Two-way | Renderer → Main with response | `ipcRenderer.invoke()` / `ipcMain.handle()` |
| Push | Main → Renderer | `webContents.send()` / `ipcRenderer.on()` |

## Process-Specific Guidelines

- @src/main/CLAUDE.md — Three-layer architecture, domain-centric app layer, command pattern, logging
- @src/renderer/CLAUDE.md — UI philosophy, reactive event handling, components, typography
