---
name: creating-skill
description: Guide for creating new Arc skills. Use whenever the user wants to create, design, or scaffold a new skill, or asks how skills work in Arc. Also use when the user says things like "turn this into a skill", "make a skill for X", or "how do I add a skill".
---

# Creating an Arc Skill

Follow this workflow to help the user create a new skill for Arc.

## Step 1: Capture Intent

Understand what the user wants before writing anything. If the conversation already contains a workflow they want to capture (e.g., "turn this into a skill"), extract the answers from history first — the tools used, sequence of steps, corrections made, input/output formats observed.

Clarify these questions (skip any already answered):

1. What should this skill enable you to do?
2. When should it trigger? (what user phrases or contexts)
3. What's the expected output format?
4. Does the skill need companion scripts or reference files?

Keep the interview short. Ask only what you need to start drafting.

## Step 2: Research

Before writing, gather context:

- Read existing skills in the profile or `@builtin` to find patterns worth reusing
- If the skill involves a specific domain, check if relevant docs or examples exist in the workspace

This prevents reinventing things that already exist.

## Step 3: Write the Skill

Before writing, read `$CREATING_SKILL_SKILL_DIR/references/conventions.md` and follow the conventions it defines (naming format, companion folder references).

### Directory Structure

Write all skill files directly to `$ARC_APP_SKILLS_DIR/<skill-name>/` using `write_file`. Although `write_file` is normally workspace-only, this skill is specially granted permission to write to `$ARC_APP_SKILLS_DIR`. Never write skill files to `$WORKSPACE` or `$SESSION_TMP` — they must go directly into the skills directory so the skill is available immediately after an app restart.

```
$ARC_APP_SKILLS_DIR/<skill-name>/
├── SKILL.md          # Required
├── references/       # Optional: docs loaded on demand
├── scripts/          # Optional: Node.js scripts (zero deps)
└── assets/           # Optional: templates, icons, etc.
```

### SKILL.md Format

```markdown
---
name: my-skill
description: What it does and when to use it.
---

Instructions go here...
```

**Frontmatter rules:**
- `name`: max 64 chars, lowercase letters, numbers, hyphens only, no leading/trailing hyphens
- `description`: max 1024 chars, non-empty

### Writing Guidelines

**Keep it lean.** Remove anything that doesn't pull its weight. A 100-line skill that works is better than a 400-line skill with filler.

**Explain the why.** LLMs respond much better to reasoning than rigid commands. Instead of "ALWAYS do X", explain why X matters. This produces more reliable, adaptable behavior.

**Progressive disclosure.** The skill system loads in three stages:
1. **Metadata** (name + description) — always in LLM context
2. **SKILL.md body** — loaded when skill triggers
3. **Bundled resources** — loaded on demand via `read_file`

Keep SKILL.md under 500 lines. If you're approaching that limit, move detailed reference material into `references/` with clear pointers about when to read each file.

**Description matters.** The description is the primary trigger mechanism — it determines whether the LLM invokes the skill. Be specific about what the skill does AND when to use it. Lean slightly "pushy" to prevent under-triggering (the LLM tends to be conservative about invoking skills).

**Scripts: Node.js only.** Arc ships with Electron's bundled Node.js, so `node` is always available. Write scripts with zero external dependencies — use only Node.js built-in modules (`fs`, `path`, `child_process`, `crypto`, etc.). Scripts run via the `run_file` tool with `runner: "node"`.

### Tools Available to Skills

When a skill is active, these tools are available:

| Tool | Purpose |
|------|---------|
| `load_skill` | Load another skill's instructions |
| `read_file` | Read files from skill dir or workspace |
| `list_dir` | List directory contents |
| `write_file` | Create/overwrite files (workspace only) |
| `edit_file` | Search-and-replace edits (workspace only) |
| `run_file` | Execute scripts with node/bash runner |

### Environment Variables

Scripts receive these env vars:
- `$WORKSPACE` — session-scoped permanent storage for deliverables
- `$SESSION_TMP` — session-scoped scratch space
- `$<SKILL_NAME>_SKILL_DIR` — the skill's own directory path

For deeper technical reference on frontmatter constraints, tool schemas, merge priority, and script execution, read `references/arc-skill-spec.md` from this skill's directory.

## Step 4: Review and Iterate

After writing the draft:

1. Re-read it with fresh eyes — would someone unfamiliar with the context understand the instructions?
2. Check for redundancy — can anything be cut without losing meaning?
3. Verify frontmatter passes validation (name format, description non-empty)
4. Ask the user to review and suggest changes

Iterate until the user is satisfied. Focus on clarity and brevity over completeness.

## Communicating with the User

Users are everyday people — they may have no technical background. Follow these rules:

- **Never show shell commands, file paths, or terminal instructions.** No `mv`, `node`, `cd`, `cp`, or any command-line syntax. If a script needs to run, use `run_file` yourself — don't ask the user to run it.
- **Never ask the user to install the skill.** Because you write directly to `$ARC_APP_SKILLS_DIR`, there is no installation step.
- **To try the new skill:** tell the user to restart the app, then use the skill button or type `/skill-name` in the chat.
