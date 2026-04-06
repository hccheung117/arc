# Artifact DevTools Workflow Patterns

## Artifact Preview & Iteration

Build and preview artifacts using a window as a live preview surface.

1. **Write files** to `$WORKSPACE` (HTML, CSS, JS)
2. **Open** with a `file://` URL pointing to the HTML file
3. **Inspect** with `query`, `styles`, or `box` to verify layout and styling
4. **Iterate** — edit files, `reload`, inspect again
5. **Screenshot** only as final signoff or when text-based inspection isn't enough

```
// Write artifact files to workspace, then preview
browser({ command: "open", args: ["file://" + workspace + "/index.html"] })

// Prefer text-based inspection (fast and cheap)
browser({ command: "query", args: ["1", ".hero"] })
browser({ command: "styles", args: ["1", ".hero", "font-size", "padding", "color"] })
browser({ command: "box", args: ["1", ".sidebar"] })

// After editing files, reload and inspect again
browser({ command: "reload", args: ["1"] })
browser({ command: "styles", args: ["1", ".hero", "font-size", "padding", "color"] })

// Screenshot only for final signoff
browser({ command: "screenshot", args: ["1"] })
```

## Debugging an Artifact

Diagnose rendering or logic issues in an artifact.

1. **Open** the artifact
2. **Console** to capture errors and warnings
3. **Eval** to inspect JavaScript state (variables, DOM properties)
4. **Styles** / **box** to check CSS issues (unexpected values, layout problems)
5. **Screenshot** only as last resort when text-based inspection doesn't clarify the issue

```
browser({ command: "open", args: ["file://" + workspace + "/artifact.html"] })

// Capture console errors
browser({ command: "console", args: ["1", "5000"] })

// Check JS state
browser({ command: "eval", args: ["1", "JSON.stringify(window.__APP_STATE__)"] })

// Inspect a broken element (prefer text-based commands)
browser({ command: "styles", args: ["1", ".broken-element", "display", "visibility", "opacity", "z-index"] })
browser({ command: "box", args: ["1", ".broken-element"] })

// Check network requests for failed resource loads
browser({ command: "network", args: ["1", "5000"] })

// Screenshot only if text-based inspection isn't enough
browser({ command: "screenshot", args: ["1"] })
```
