# Arc Skill Specification Reference

Detailed technical reference for Arc's skill system. Read this when you need specifics beyond what the main SKILL.md covers.

## Frontmatter Schema

| Field | Required | Constraints |
|-------|----------|-------------|
| `name` | Yes | Max 64 chars. Lowercase letters, numbers, hyphens. No leading/trailing hyphens. |
| `description` | Yes | Max 1024 chars. Non-empty. |
| `license` | No | Free-form string |
| `compatibility` | No | Object describing required tools/deps |
| `metadata` | No | Arbitrary key-value pairs |

## Directory Layout

```
skills/<skill-name>/
├── SKILL.md       # Required: YAML frontmatter + markdown instructions
├── references/    # Companion docs, loaded on demand via read_file
├── scripts/       # Node.js scripts, executed via run_file
└── assets/        # Templates, icons, fonts — used in output
```

## Discovery and Merge Priority

Skills are discovered at conversation start and merged by priority (highest first):

1. **`@app`** — personal user overrides
2. **Active profile** — shared configuration
3. **`@builtin`** — shipped with the application

A skill in a higher-priority source overrides one with the same name in a lower-priority source.

## Built-in Skill Constraints

- Built-in skills (`@builtin`) are **read-only** — the LLM can read and execute files from them but cannot modify their contents.
- User/profile skills are fully writable.

## Activation Flow

1. User invokes skill with `/skillName` prefix in message
2. First activation: full SKILL.md content injected into LLM context
3. Subsequent messages: skill stays in history, no re-injection
4. System prompt always includes the catalog of available skills (names + descriptions)

## Tool Schemas

### load_skill

Load a skill's full instructions by name.

```json
{ "name": "skill-name" }
```

Returns the skill's SKILL.md content and its directory URL.

### run_file (exec)

Execute a script from the skill directory.

```json
{
  "runner": "node",
  "script": "scripts/my-script.js --flag value",
  "cwd": "arcfs://skills/my-skill"
}
```

- **`runner`**: `node` (always available via Electron's `ELECTRON_RUN_AS_NODE`), `bash` (macOS/Linux), `powershell` (Windows)
- **`script`**: path and arguments relative to `cwd`
- **`cwd`**: typically the skill directory URL from `load_skill`
- Returns: `{ stdout, stderr, exitCode }`

### File Tools

- **`read_file`**: Read from skill dir or workspace. Input: `{ "path": "..." }`
- **`write_file`**: Write to workspace only. Input: `{ "path": "...", "content": "..." }`
- **`edit_file`**: Search-and-replace in workspace files. Input: `{ "path": "...", "old": "...", "new": "..." }`
- **`list_dir`**: List directory contents. Input: `{ "path": "..." }`

## Environment Variables

Available in script execution context:

| Variable | Description |
|----------|-------------|
| `WORKSPACE` | Session-scoped permanent storage for deliverables |
| `SESSION_TMP` | Session-scoped temporary scratch space |
| `<SKILL_NAME>_SKILL_DIR` | The skill's own directory path (name uppercased, hyphens become underscores) |

## Script Guidelines

- Use **Node.js only** with zero external dependencies
- Only Node.js built-in modules
- Node.js is universally available via Electron's bundled binary
- Scripts run to completion with no timeout
