---
description: Audit and fix git commit messages after a given tag/ref by comparing each message against its actual diff
---

# Fix Git Commit Messages

You audit every commit message after a given ref by inspecting the actual diff, then rewrite any inaccurate messages using `git filter-branch --msg-filter`.

## Input

Ask the user for:
1. **Base ref** — the tag or commit to start from (e.g. `v0.2.1`). All commits after this ref will be audited.

## Procedure

### 1. List commits

```
git log --oneline <base-ref>..HEAD
```

### 2. Audit each commit (oldest first)

For every commit after `<base-ref>`, retrieve the diff summary and full patch:

```
git show --stat <hash>
git show -p <hash>
```

Compare the **current commit message** against the **actual changes**. Flag a message as wrong if:

- The subject line contradicts the diff (e.g. says "clear" when the change preserves)
- The conventional commit type is wrong:
  - `feat:` used for documentation-only, config-only, or deletion-only changes
  - `refactor:` used for documentation-only changes
  - `fix:` used when nothing is actually fixed
- The subject omits the most significant change in the diff
- The subject focuses on a minor detail while the main change is something else entirely

Do **not** flag a message if it is merely imprecise but not misleading.

### 3. Present corrections

Before making any changes, present a table to the user:

| Hash | Current Message | Suggested Message | Reason |
|------|----------------|-------------------|--------|

Only include commits that need correction. Wait for the user to confirm.

### 4. Apply corrections

Write a temporary shell script that uses a `case` statement on the subject line to map old messages to new ones. Then run:

```
git filter-branch -f --msg-filter "/path/to/script.sh" <base-ref>..HEAD
```

Delete the temporary script after successful rewrite.

### 5. Verify

```
git log --oneline <base-ref>..HEAD
```

Confirm all corrections were applied. Remind the user that:
- All commit hashes after `<base-ref>` have changed
- A force push is required if the branch was already pushed: `git push --force-with-lease origin <branch>`
- The original history is preserved at `refs/original/refs/heads/<branch>` until garbage collected

## Conventional Commit Type Reference

| Type | Use when |
|------|----------|
| `feat:` | New user-facing functionality or capability |
| `fix:` | Bug fix or correcting wrong behavior |
| `refactor:` | Code restructuring with no behavior change |
| `chore:` | Build, deps, config, tooling, deletions of unused code |
| `docs:` | Documentation-only changes (markdown, comments, agent docs) |
| `test:` | Adding or updating tests only |
| `style:` | Formatting, whitespace, linting config (no logic change) |
