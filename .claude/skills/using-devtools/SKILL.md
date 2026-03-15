---
name: using-devtools
description: Use when debugging UI issues, inspecting DOM, checking styles, taking screenshots, or investigating runtime state in the running Electron app
---

# Electron DevTools

Inspect the running Electron app via Chrome DevTools Protocol.

## Prerequisites

App must be running with CDP enabled:
```bash
npm run start:debug
```

## Usage

```bash
node scripts/devtools.mjs <command> [args...]
```

## Commands

| Command | Example | Use for |
|---------|---------|---------|
| `screenshot [file]` | `screenshot /tmp/ui.png` | See current UI state |
| `eval <expr>` | `eval document.title` | Run any JS (supports await) |
| `query <sel>` | `query .composer` | Element outerHTML |
| `query-all <sel>` | `query-all button` | All matching elements |
| `text [sel]` | `text .sidebar` | Text content |
| `styles <sel> [props]` | `styles .panel display width` | Computed CSS |
| `box <sel>` | `box .composer` | Bounding box (x, y, w, h) |
| `attrs <sel>` | `attrs [data-state]` | Element attributes |
| `html` | | Full page HTML |
| `accessibility` | | Full a11y tree |
| `metrics` | | Performance metrics |
| `cookies` | | All cookies |
| `storage [local\|session]` | `storage local` | Web storage |
| `console [ms]` | `console 3000` | Capture console output |
| `network [ms]` | `network 5000` | Capture network requests |
| `cdp <Method> [json]` | `cdp DOM.getDocument '{"depth":2}'` | Raw CDP command |
| `targets` | | List debug targets |

## Workflow

1. `screenshot` first to see current state
2. `query`/`styles`/`box` to inspect specific elements
3. `eval` for anything not covered by convenience commands
4. `cdp` for full CDP access (any domain/method)

## Extending

If a debugging session needs a command that doesn't exist yet, add it to `scripts/devtools.mjs` directly. The script is a living tool — enhance it as needs arise.

## Notes

- `console` and `network` are event-based — they capture output during the listen window, not historical
- Port defaults to 9222, override with `--port=N` or `CDP_PORT` env var
- App has no `#root` — main container is `body > div`
