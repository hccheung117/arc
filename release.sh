#!/bin/bash
set -e

STASHED=false

unstash() {
  if [ "$STASHED" = true ]; then
    git stash pop --quiet
    STASHED=false
  fi
}

trap unstash EXIT

# ── Phase 1: Git checks ──────────────────────────────

echo ""
echo "  Checking git state..."

BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "main" ]; then
  echo "  Error: must be on main (currently on $BRANCH)"
  exit 1
fi

git fetch origin main --tags --quiet

if [ -n "$(git log origin/main..HEAD --oneline)" ]; then
  echo "  Error: you have unpushed commits — push or reset first"
  exit 1
fi

if [ -n "$(git log HEAD..origin/main --oneline)" ]; then
  echo "  Error: main is behind origin/main — pull first"
  exit 1
fi

echo "  Git state OK."

# ── Phase 2: Version picker ──────────────────────────

echo ""
node -e "
const s = require('semver'), v = require('./package.json').version;
console.log('  Current version: ' + v);
console.log();
['patch','minor','major','prepatch','preminor','premajor','prerelease'].forEach((t, i) =>
  console.log('  ' + (i + 1) + ') ' + t.padEnd(12) + ' → ' + s.inc(v, t)));
"
echo ""

read -p "  Pick one: " CHOICE
TYPES=(patch minor major prepatch preminor premajor prerelease)
TYPE="${TYPES[$((CHOICE - 1))]}"

if [ -z "$TYPE" ]; then
  echo "  Invalid choice."
  exit 1
fi

NEW_VERSION=$(node -e "console.log(require('semver').inc(require('./package.json').version, '$TYPE'))")

if [ -n "$(git tag -l "v$NEW_VERSION")" ]; then
  echo "  Error: tag v$NEW_VERSION already exists."
  echo "  If this is from a reverted release, clean it up with:"
  echo "    git tag -d v$NEW_VERSION && git push origin :refs/tags/v$NEW_VERSION"
  exit 1
fi

echo "  Will release v$NEW_VERSION"

# ── Stash uncommitted changes ────────────────────────

if [ -n "$(git status --porcelain)" ]; then
  git stash push --include-untracked --quiet -m "release: auto-stash before v$NEW_VERSION"
  STASHED=true
  echo "  Stashed uncommitted changes."
fi

# ── Phase 3: E2E tests ───────────────────────────────

echo ""
echo "  Running e2e tests..."
npm run test:e2e
echo "  All e2e tests passed!"

# ── Phase 4: Release ─────────────────────────────────

echo ""
npm version "$TYPE" -m "chore: release %s"
git push origin main --follow-tags

unstash

echo ""
echo "  Done! v$NEW_VERSION release triggered."
echo ""
