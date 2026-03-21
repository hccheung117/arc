# Workspace

This guide explains how Arc's workspace system manages a persistent whitelist of filesystem paths that the AI is permitted to read, replacing per-action user prompts with automatic path approval based on user mentions.

## How It Works

Arc replaces traditional per-action approval prompts with a workspace model. The workspace is a persisted set of paths the AI may read. Paths inside the workspace are accessible; paths outside are denied. 

When a user mentions a file or folder in a message, its path is automatically added to the whitelist. The `read` tool checks this whitelist before accessing any paths outside the internal `arcfs` virtual filesystem.

Currently, the workspace enables read-only access.

## Data Model

The workspace is stored as a flat JSON array of absolute path strings, persisted at `arcfs/workspace.json`. Directories end with a trailing slash (`/`) to distinguish them from files.

```json
[
  "/Users/you/Code/project/",
  "/Users/you/Documents/notes.md"
]
```

- All paths are stored in resolved, absolute form (using `path.resolve()` before storage). 
- There are no `~`, `..`, or relative paths. 
- Paths are host-native (Windows-style on Windows, POSIX on macOS/Linux), normalized using Node's `path` module on the running OS.
- The whitelist is global and persistent—once a path is granted, it stays granted across all sessions. 

## Smart Merging

When a path is added, the list is normalized to prevent redundancy:

1. **Ancestor covers new path**: Adding `/a/b/c.js` when `/a/b/` exists is a no-op.
2. **New path covers existing entries**: Adding `/a/b/` when `/a/b/c.js` and `/a/b/d/` exist removes both and adds `/a/b/`.
3. **No overlap**: The path is simply appended.

### Coverage Rules

- **Directory entries** (trailing `/`): A path is covered if it starts with the directory string. The trailing `/` prevents partial matches (e.g., `/a/bc` does not match `/a/b/`).
- **File entries** (no trailing `/`): Exact match only. `/notes.md` does not cover `/notes.md.backup`.

`isAllowed(path)` uses these same coverage rules by checking all entries and returning `true` on the first match. Removing a path deletes the exact entry without partial splitting (i.e., removing a directory revokes the entire subtree).

```text
add('/a/b/')        → ['/a/b/']
add('/a/b/c.js')    → ['/a/b/']                 # no-op, covered by dir
add('/x/y.js')      → ['/a/b/', '/x/y.js']      # no overlap

add('/a/b/c.js')    → ['/a/b/c.js']             # starting fresh
add('/a/b/d/')      → ['/a/b/c.js', '/a/b/d/']
add('/a/b/')        → ['/a/b/']                 # subsumes both
```

## Integration

### File Mentions

The workspace reacts to file mentions regardless of the input method (e.g., attach button, drag-and-drop). The original filesystem path is preserved and passed to `workspace.add()` at the point where the main process first handles the attachment—before or alongside the file being copied into `arcfs://` storage.

Attachments without a source filesystem path (like pasted in-memory blobs) do not trigger path additions.

### Tool Awareness

The `read` tool is workspace-aware. In addition to internal `arcfs://` URLs, it accepts real filesystem paths gated by `workspace.isAllowed()`.

All incoming paths are resolved via `path.resolve()` before the `isAllowed()` check to ensure relative paths and `..` correctly map to stored entries.

```text
arcfs:// path       →  resolve via fromUrl()        (existing behavior)
real path allowed   →  use directly                  
real path denied    →  'Access denied: not in workspace'
```

*Note: Tools like `exec` and `load_skill` serve different purposes (executing scripts and loading skill instructions) and are not subject to the workspace concept.*