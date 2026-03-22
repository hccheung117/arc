# Skill Conventions

Follow these conventions when creating any Arc skill.

## Naming

Use **verb-ing noun** format: the skill name should start with a gerund (present participle) describing the action.

**Good:** `creating-skill`, `debugging-code`, `generating-reports`, `formatting-documents`
**Bad:** `skill-creator`, `code-debug`, `report-gen`, `doc-formatter`

The gerund form makes the skill's purpose immediately obvious — it reads as "this skill is for [creating skills]".

## Companion Folder References

When a skill refers to its own companion files (scripts, references, assets), always use the full path from the skill root via the `$<SKILL_NAME>_SKILL_DIR` environment variable.

**Good:**
- "Read `$CREATING_SKILL_SKILL_DIR/references/spec.md` for the full schema."
- "Run `$DEBUGGING_CODE_SKILL_DIR/scripts/analyze.js` to collect diagnostics."

**Bad:**
- "Read `references/spec.md`..."
- "Run `analyze.js`..."

This matters because bare filenames are ambiguous — they could refer to workspace files, other skills, or relative paths that don't resolve in the script execution context. The `$<SKILL_NAME>_SKILL_DIR` variable always resolves to the skill's own directory, making paths unambiguous and portable.

Remember: the variable name is the skill name uppercased with hyphens replaced by underscores, plus `_SKILL_DIR` (e.g., `creating-skill` → `$CREATING_SKILL_SKILL_DIR`).
