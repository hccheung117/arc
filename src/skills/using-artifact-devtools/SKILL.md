---
name: using-artifact-devtools
description: Inspect, debug, and refine artifacts displayed in Electron windows via Chrome DevTools Protocol (CDP). Use when you need to screenshot, query DOM, check styles, or evaluate JS in an artifact window. This is NOT a web browser — it is a devtool for artifact content.
---

# Artifact DevTools

Inspect and refine artifacts rendered in Electron windows using Chrome DevTools Protocol. Each window displays artifact content (HTML pages, previews, visualizations) — you interact with them as a developer would with DevTools, not as a user would with a web browser.

## Quick Start

Open an artifact window:
browser({ command: "open", args: ["file:///path/to/artifact.html"] })

Inspect structure and styles (prefer these — fast and cheap):
browser({ command: "query", args: ["1", ".main"] })
browser({ command: "styles", args: ["1", ".main", "display", "width"] })

## Command Categories

| Category | Commands | Use for |
|----------|----------|---------|
| Lifecycle | open, close, list | Managing artifact windows |
| Navigation | navigate, back, forward, reload | Reloading after edits |
| Visual | screenshot, pdf | Last resort or final signoff — slow and expensive, prefer text-based commands first |
| DOM | html, query, query-all, text, attrs, box | Inspecting artifact structure |
| Interaction | click, type, select | Testing interactive artifacts |
| JavaScript | eval | Running JS in artifact context |
| CSS | styles | Inspecting computed styles |
| Info | url, title, cookies, storage | Reading artifact metadata |
| Monitor | console, network | Capturing runtime events |
| Raw | cdp | Any Chrome DevTools Protocol command |

## References

For full command details with all arguments and examples:
→ Read `$USING_ARTIFACT_DEVTOOLS_SKILL_DIR/references/commands.md`

For workflow patterns (artifact preview, debugging, iteration):
→ Read `$USING_ARTIFACT_DEVTOOLS_SKILL_DIR/references/workflows.md`
