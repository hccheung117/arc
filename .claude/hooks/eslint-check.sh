#!/bin/bash

# ESLint hook for Claude Code
# Runs ESLint on TypeScript/JavaScript files after edits

# Parse the file path from hook input JSON
file_path=$(cat | jq -r '.tool_input.file_path // empty' 2>/dev/null)

# Exit early if no file path or not a JS/TS file
if [[ -z "$file_path" ]] || [[ ! "$file_path" =~ \.(ts|tsx|js|jsx|mjs|cjs)$ ]]; then
  exit 0
fi

# Skip node_modules
if [[ "$file_path" == *"node_modules"* ]]; then
  exit 0
fi

# Find the nearest directory with an ESLint config
find_eslint_root() {
  local dir="$1"
  while [[ "$dir" != "/" ]]; do
    if ls "$dir"/eslint.config.* 1>/dev/null 2>&1; then
      echo "$dir"
      return 0
    fi
    dir=$(dirname "$dir")
  done
  return 1
}

file_dir=$(dirname "$file_path")
eslint_root=$(find_eslint_root "$file_dir")

if [[ -z "$eslint_root" ]]; then
  # No ESLint config found, skip
  exit 0
fi

# Run ESLint from the config directory
cd "$eslint_root" || exit 0
output=$(npx eslint "$file_path" 2>&1)
exit_code=$?

if [[ $exit_code -ne 0 ]]; then
  echo "$output" >&2
  # Exit 2 blocks the action and shows stderr to Claude
  exit 2
fi

exit 0
