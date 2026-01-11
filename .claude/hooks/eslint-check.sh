#!/bin/bash

# ESLint Stop hook for Claude Code
# Runs ESLint on modified TS/JS files when Claude tries to stop
# Blocks Claude from stopping if there are linting errors

input=$(cat)
cwd=$(echo "$input" | jq -r '.cwd // empty')
stop_hook_active=$(echo "$input" | jq -r '.stop_hook_active // false')

# Prevent infinite loops - if we already blocked once, let Claude stop
if [[ "$stop_hook_active" == "true" ]]; then
  exit 0
fi

# Exit if no cwd
if [[ -z "$cwd" ]]; then
  exit 0
fi

cd "$cwd" || exit 0

# Navigate to git repo root for npm workspace commands
repo_root=$(git rev-parse --show-toplevel 2>/dev/null)
if [[ -z "$repo_root" ]]; then
  exit 0
fi
cd "$repo_root" || exit 0

# Get modified TS/JS files from git (both staged and unstaged changes)
# Filter to apps/desktop only and strip the prefix for ESLint
modified_files=$(git diff --name-only HEAD 2>/dev/null | grep -E '^apps/desktop/.*\.(ts|tsx)$' | sed 's|^apps/desktop/||' || true)

# Also include untracked new files
untracked_files=$(git ls-files --others --exclude-standard 2>/dev/null | grep -E '^apps/desktop/.*\.(ts|tsx)$' | sed 's|^apps/desktop/||' || true)

# Combine both lists
all_files=$(echo -e "${modified_files}\n${untracked_files}" | grep -v '^$' | sort -u)

# Exit if no modified TS files in apps/desktop
if [[ -z "$all_files" ]]; then
  exit 0
fi

# Run lint via npm workspace - paths are relative to apps/desktop
output=$(npm run lint -w apps/desktop -- $all_files 2>&1)
exit_code=$?

if [[ $exit_code -ne 0 ]]; then
  # Build valid JSON using jq - handles all escaping correctly
  jq -n --arg reason "ESLint errors found. Fix all linting issues before stopping:" --arg output "$output" \
    '{decision: "block", reason: ($reason + "\n\n" + $output)}'
fi

exit 0
