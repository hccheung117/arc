# Browser Workflow Patterns

## Website Building

Build and preview a site using the browser as a live preview window.

1. **Write files** to `$WORKSPACE` (HTML, CSS, JS)
2. **Open** with a `file://` URL pointing to the HTML file
3. **Screenshot** to see the rendered result
4. **Inspect** with `query`, `styles`, or `box` to verify layout and styling
5. **Iterate** — edit files, `reload`, screenshot again

```
// Write HTML to workspace, then preview
browser({ command: "open", args: ["file://" + workspace + "/index.html"] })
browser({ command: "screenshot", args: ["1"] })

// After editing files, reload and check
browser({ command: "reload", args: ["1"] })
browser({ command: "screenshot", args: ["1"] })

// Inspect specific elements
browser({ command: "styles", args: ["1", ".hero", "font-size", "padding", "color"] })
browser({ command: "box", args: ["1", ".sidebar"] })
```

## Web Research

Read and navigate web content.

1. **Open** the target URL
2. **Text** to read the page content (use a selector to focus on the article body)
3. **Query-all** to find links for further reading
4. **Navigate** to follow relevant links
5. **Screenshot** when visual context matters (charts, layouts, diagrams)

```
browser({ command: "open", args: ["https://docs.example.com"] })
browser({ command: "text", args: ["1", "article"] })

// Find all links in the content
browser({ command: "query-all", args: ["1", "article a[href]"] })

// Follow a link
browser({ command: "navigate", args: ["1", "https://docs.example.com/api"] })
browser({ command: "text", args: ["1", "main"] })

// Capture a diagram or chart
browser({ command: "screenshot", args: ["1"] })
```

## Debugging a Page

Diagnose issues on a web page.

1. **Open** the page
2. **Console** to capture errors and warnings
3. **Eval** to inspect JavaScript state (variables, DOM properties)
4. **Screenshot** to see the current UI state
5. **Styles** to check CSS issues (unexpected values, inheritance problems)

```
browser({ command: "open", args: ["http://localhost:3000"] })

// Capture console errors
browser({ command: "console", args: ["1", "5000"] })

// Check JS state
browser({ command: "eval", args: ["1", "JSON.stringify(window.__APP_STATE__)"] })

// Inspect a broken element
browser({ command: "screenshot", args: ["1"] })
browser({ command: "styles", args: ["1", ".broken-element", "display", "visibility", "opacity", "z-index"] })
browser({ command: "box", args: ["1", ".broken-element"] })

// Check network requests for failed API calls
browser({ command: "network", args: ["1", "5000"] })
```

## Form Automation

Fill and submit forms programmatically.

1. **Open** the page with the form
2. **Query** to find form inputs and understand the structure
3. **Type** to fill text inputs
4. **Select** to choose dropdown options
5. **Click** to submit
6. **Screenshot** to verify the result

```
browser({ command: "open", args: ["https://example.com/signup"] })

// Discover form structure
browser({ command: "query-all", args: ["1", "form input, form select, form textarea"] })

// Fill the form
browser({ command: "type", args: ["1", "input[name='name']", "Jane Doe"] })
browser({ command: "type", args: ["1", "input[name='email']", "jane@example.com"] })
browser({ command: "select", args: ["1", "select[name='plan']", "pro"] })

// Submit and verify
browser({ command: "click", args: ["1", "button[type='submit']"] })
browser({ command: "screenshot", args: ["1"] })
```
