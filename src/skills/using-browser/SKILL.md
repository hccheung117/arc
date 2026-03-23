---
name: using-browser
description: Control browser windows for web browsing, website building, page inspection, and automation. Use when the user wants to open a webpage, build/preview a website, inspect a page, or automate browser interaction.
---

# Browser Control

You can open and control browser windows via the `browser` tool. Windows are real Electron browser windows — both you and the user can interact with them.

## Quick Start

Open a window:
browser({ command: "open", args: ["https://example.com"] })

Take a screenshot to see current state:
browser({ command: "screenshot", args: ["1"] })

## Command Categories

| Category | Commands | Use for |
|----------|----------|---------|
| Lifecycle | open, close, list | Managing browser windows |
| Navigation | navigate, back, forward, reload | Moving between pages |
| Visual | screenshot, pdf | Capturing page state |
| DOM | html, query, query-all, text, attrs, box | Reading page structure |
| Interaction | click, type, select | Interacting with page elements |
| JavaScript | eval | Running arbitrary JS |
| CSS | styles | Inspecting computed styles |
| Info | url, title, cookies, storage | Reading page metadata |
| Monitor | console, network | Capturing runtime events |
| Raw | cdp | Any Chrome DevTools Protocol command |

## References

For full command details with all arguments and examples:
→ Read `$USING_BROWSER_SKILL_DIR/references/commands.md`

For workflow patterns (website building, research, debugging):
→ Read `$USING_BROWSER_SKILL_DIR/references/workflows.md`
