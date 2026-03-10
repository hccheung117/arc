#!/bin/bash
set -e

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

echo ""
npm version "$TYPE" -m "chore: release %s"
git push && git push --tags
echo ""
echo "  Done! Release triggered."
echo ""
