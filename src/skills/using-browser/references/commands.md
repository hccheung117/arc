# Browser Command Reference

The `browser` tool accepts `{ command: string, args: string[] }`.

For commands that operate on a window, the window ID is always `args[0]`. The `open` and `list` commands do not require a window ID.

## Error Handling

- Invalid window ID → `{ error: "Window not found: <id>" }`
- Missing required argument → `{ error: "Missing required argument: <name>" }`

---

## Lifecycle

### open

Open a new browser window, optionally navigating to a URL.

| Arg | Position | Required | Description |
|-----|----------|----------|-------------|
| url | args[0] | No | URL to open. Omit for a blank window. |

```
browser({ command: "open", args: ["https://example.com"] })
browser({ command: "open", args: [] })
```

Returns the new window's ID.

### close

Close a browser window.

| Arg | Position | Required | Description |
|-----|----------|----------|-------------|
| id | args[0] | Yes | Window ID to close. |

```
browser({ command: "close", args: ["1"] })
```

### list

List all open browser windows with their IDs and current URLs.

No arguments.

```
browser({ command: "list", args: [] })
```

---

## Navigation

### navigate

Navigate a window to a URL.

| Arg | Position | Required | Description |
|-----|----------|----------|-------------|
| id | args[0] | Yes | Window ID. |
| url | args[1] | Yes | URL to navigate to. |

```
browser({ command: "navigate", args: ["1", "https://example.com/page"] })
```

### back

Go back in the window's navigation history.

| Arg | Position | Required | Description |
|-----|----------|----------|-------------|
| id | args[0] | Yes | Window ID. |

```
browser({ command: "back", args: ["1"] })
```

### forward

Go forward in the window's navigation history.

| Arg | Position | Required | Description |
|-----|----------|----------|-------------|
| id | args[0] | Yes | Window ID. |

```
browser({ command: "forward", args: ["1"] })
```

### reload

Reload the current page.

| Arg | Position | Required | Description |
|-----|----------|----------|-------------|
| id | args[0] | Yes | Window ID. |

```
browser({ command: "reload", args: ["1"] })
```

---

## Visual

### screenshot

Capture a screenshot of the window as PNG.

| Arg | Position | Required | Description |
|-----|----------|----------|-------------|
| id | args[0] | Yes | Window ID. |
| file | args[1] | No | File path to save to. Omit to save to session temp directory. |

```
browser({ command: "screenshot", args: ["1"] })
browser({ command: "screenshot", args: ["1", "/tmp/page.png"] })
```

### pdf

Export the page as PDF.

| Arg | Position | Required | Description |
|-----|----------|----------|-------------|
| id | args[0] | Yes | Window ID. |
| file | args[1] | No | File path to save to. Omit to save to session temp directory. |

```
browser({ command: "pdf", args: ["1"] })
browser({ command: "pdf", args: ["1", "/tmp/page.pdf"] })
```

---

## DOM

### html

Get the full HTML of the page.

| Arg | Position | Required | Description |
|-----|----------|----------|-------------|
| id | args[0] | Yes | Window ID. |

```
browser({ command: "html", args: ["1"] })
```

### query

Find the first element matching a CSS selector. Returns its outer HTML.

| Arg | Position | Required | Description |
|-----|----------|----------|-------------|
| id | args[0] | Yes | Window ID. |
| selector | args[1] | Yes | CSS selector. |

```
browser({ command: "query", args: ["1", "h1.title"] })
```

### query-all

Find all elements matching a CSS selector (max 50 results). Returns an array of outer HTML strings.

| Arg | Position | Required | Description |
|-----|----------|----------|-------------|
| id | args[0] | Yes | Window ID. |
| selector | args[1] | Yes | CSS selector. |

```
browser({ command: "query-all", args: ["1", "a.nav-link"] })
```

### text

Get the text content of the page or a specific element.

| Arg | Position | Required | Description |
|-----|----------|----------|-------------|
| id | args[0] | Yes | Window ID. |
| selector | args[1] | No | CSS selector. Omit to get all page text. |

```
browser({ command: "text", args: ["1"] })
browser({ command: "text", args: ["1", "article.main"] })
```

### attrs

Get all attributes of an element.

| Arg | Position | Required | Description |
|-----|----------|----------|-------------|
| id | args[0] | Yes | Window ID. |
| selector | args[1] | Yes | CSS selector. |

```
browser({ command: "attrs", args: ["1", "img.hero"] })
```

### box

Get the bounding box (position and size) of an element.

| Arg | Position | Required | Description |
|-----|----------|----------|-------------|
| id | args[0] | Yes | Window ID. |
| selector | args[1] | Yes | CSS selector. |

```
browser({ command: "box", args: ["1", ".modal"] })
```

---

## Interaction

### click

Click an element.

| Arg | Position | Required | Description |
|-----|----------|----------|-------------|
| id | args[0] | Yes | Window ID. |
| selector | args[1] | Yes | CSS selector of the element to click. |

```
browser({ command: "click", args: ["1", "button.submit"] })
```

### type

Type text into an input or textarea.

| Arg | Position | Required | Description |
|-----|----------|----------|-------------|
| id | args[0] | Yes | Window ID. |
| selector | args[1] | Yes | CSS selector of the input. |
| text | args[2] | Yes | Text to type. |

```
browser({ command: "type", args: ["1", "input[name='email']", "user@example.com"] })
```

### select

Select an option in a `<select>` element.

| Arg | Position | Required | Description |
|-----|----------|----------|-------------|
| id | args[0] | Yes | Window ID. |
| selector | args[1] | Yes | CSS selector of the select element. |
| value | args[2] | Yes | Value of the option to select. |

```
browser({ command: "select", args: ["1", "select#country", "US"] })
```

---

## JavaScript

### eval

Evaluate a JavaScript expression in the page context. Returns the result.

| Arg | Position | Required | Description |
|-----|----------|----------|-------------|
| id | args[0] | Yes | Window ID. |
| expression | args[1] | Yes | JavaScript expression to evaluate. |

```
browser({ command: "eval", args: ["1", "document.title"] })
browser({ command: "eval", args: ["1", "window.scrollTo(0, document.body.scrollHeight)"] })
```

---

## CSS

### styles

Get computed styles of an element. Optionally filter to specific properties.

| Arg | Position | Required | Description |
|-----|----------|----------|-------------|
| id | args[0] | Yes | Window ID. |
| selector | args[1] | Yes | CSS selector. |
| ...props | args[2+] | No | Specific CSS property names. Omit to get all. |

```
browser({ command: "styles", args: ["1", ".header"] })
browser({ command: "styles", args: ["1", ".header", "color", "font-size", "margin"] })
```

---

## Info

### url

Get the current URL of the window.

| Arg | Position | Required | Description |
|-----|----------|----------|-------------|
| id | args[0] | Yes | Window ID. |

```
browser({ command: "url", args: ["1"] })
```

### title

Get the current page title.

| Arg | Position | Required | Description |
|-----|----------|----------|-------------|
| id | args[0] | Yes | Window ID. |

```
browser({ command: "title", args: ["1"] })
```

### cookies

Get all cookies for the current page.

| Arg | Position | Required | Description |
|-----|----------|----------|-------------|
| id | args[0] | Yes | Window ID. |

```
browser({ command: "cookies", args: ["1"] })
```

### storage

Get localStorage or sessionStorage contents.

| Arg | Position | Required | Description |
|-----|----------|----------|-------------|
| id | args[0] | Yes | Window ID. |
| type | args[1] | No | `local` or `session`. Defaults to `local`. |

```
browser({ command: "storage", args: ["1"] })
browser({ command: "storage", args: ["1", "session"] })
```

---

## Monitor

### console

Capture console output for a duration.

| Arg | Position | Required | Description |
|-----|----------|----------|-------------|
| id | args[0] | Yes | Window ID. |
| ms | args[1] | No | Duration in milliseconds. Default: 2000. |

```
browser({ command: "console", args: ["1"] })
browser({ command: "console", args: ["1", "5000"] })
```

### network

Capture network requests for a duration.

| Arg | Position | Required | Description |
|-----|----------|----------|-------------|
| id | args[0] | Yes | Window ID. |
| ms | args[1] | No | Duration in milliseconds. Default: 3000. |

```
browser({ command: "network", args: ["1"] })
browser({ command: "network", args: ["1", "10000"] })
```

---

## Raw

### cdp

Send a raw Chrome DevTools Protocol command.

| Arg | Position | Required | Description |
|-----|----------|----------|-------------|
| id | args[0] | Yes | Window ID. |
| Method | args[1] | Yes | CDP method name (e.g., `Page.captureScreenshot`). |
| json | args[2] | No | JSON string of parameters. |

```
browser({ command: "cdp", args: ["1", "Page.captureScreenshot", "{\"format\":\"jpeg\",\"quality\":50}"] })
browser({ command: "cdp", args: ["1", "Runtime.evaluate", "{\"expression\":\"1+1\"}"] })
```
