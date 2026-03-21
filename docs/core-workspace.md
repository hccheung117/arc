# Workspace

This guide explains how Arc's workspace system manages file access. It consists of two main concepts: a **Global Workspace** (a persistent whitelist of user-approved filesystem paths) and a **Session Workspace** (an isolated, session-scoped scratchpad for the AI).

## Global Workspace

Arc replaces traditional per-action approval prompts with a global workspace model. The global workspace is a persisted set of paths the AI may read. Paths inside the workspace are accessible; paths outside are denied. 

When a user mentions a text or code file or folder in a message, its path is automatically added to the whitelist. The `read_file` tool checks this whitelist before accessing any paths outside the internal `arcfs` virtual filesystem.

The global workspace enables **read and write** access via `read_file`, `list_dir`, `write_file`, and `edit_file`.

### Data Model

The global workspace is stored as a flat JSON array of absolute path strings, persisted at `arcfs/workspace.json`. Directories end with a trailing slash (`/`) to distinguish them from files.

```json
[
  "/Users/you/Code/project/",
  "/Users/you/Documents/notes.md"
]
```

- All paths are stored in resolved, absolute form (using `path.resolve()` before storage). Tilde (`~`) paths are explicitly expanded to the user's home directory before evaluation.
- There are no `..` or relative paths. 
- Paths are host-native (Windows-style on Windows, POSIX on macOS/Linux), normalized using Node's `path` module on the running OS.
- The whitelist is global and persistent—once a path is granted, it stays granted across all sessions. 

### Smart Merging

When a path is added, the list is normalized to prevent redundancy:

1. **Ancestor covers new path**: Adding `/a/b/c.js` when `/a/b/` exists is a no-op.
2. **New path covers existing entries**: Adding `/a/b/` when `/a/b/c.js` and `/a/b/d/` exist removes both and adds `/a/b/`.
3. **No overlap**: The path is simply appended.

#### Coverage Rules

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

## Session Workspace

In addition to the global read-only whitelist, Arc provides a per-session workspace directory at `arcfs/sessions/<id>/workspace/`. This gives the AI a session-scoped space to autonomously store and retrieve files (experiment outputs, generated artifacts, scratch data) without user involvement.

- **Automated & Lazy**: The directory is managed by `arcfs` and created lazily on the first message send.
- **Auto-granted**: Paths inside `arcfs` bypass the global workspace whitelist check. The `read_file` tool can access them automatically.
- **Skill Integration**: Skill scripts can write to the session workspace by receiving its `arcfs://` URL as an argument. The system prompt is automatically injected with an XML block (`<session_workspace>`) containing the workspace path so the AI knows where its working directory is.

## Integration & Smart File Mentions

The workspace reacts to file mentions in the chat composer (e.g., `@/path/to/file`). The plain text with `@` mentions is the single source of truth—the legacy `attachments` array concept is removed, and the backend parses these directly from the user's message text.

For each extracted file reference, the system evaluates its path and type to apply one of three strategies:

1. **Move Strategy (Temp Files & Drag-and-Drop Blobs)**
   - **Condition:** Path starts with `arcfs://tmp/` (created when the UI handles a paste or drag-and-drop without a real file path).
   - **Action:** The file is moved into the session's permanent `files` directory (`arcfs://sessions/<id>/files/`), and passed to the LLM directly as a file part.
2. **Copy Strategy (Local Images)**
   - **Condition:** Path is a local filesystem path with an image extension (`.png`, `.jpg`, etc.).
   - **Action:** The image is copied from the local filesystem into the session's permanent `files` directory, and passed to the LLM via the multimodal API.
3. **Reference Strategy (Other Local Files)**
   - **Condition:** Path is a local filesystem path and is NOT an image.
   - **Action:** The file is **not** copied into `arcfs`. Instead, its real path is added to the global workspace whitelist (`workspace.add(path)`). 
   - **Context Augmentation:** An XML block (`<workspace_files>`) is generated and injected into the user message, instructing the AI to use the `read_file` tool to access the live contents of the referenced files. This ensures zero overhead for code by avoiding duplication of large files and enforces the read-in-place paradigm.
