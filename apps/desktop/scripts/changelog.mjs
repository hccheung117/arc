#!/usr/bin/env node

/**
 * Generates a categorized changelog from conventional commits between two git tags.
 *
 * Usage: node scripts/changelog.mjs <tag>
 *
 * Finds the previous tag automatically and groups commits by type.
 * Outputs markdown to stdout.
 */

import { execSync } from 'node:child_process';

const CATEGORIES = [
  { type: 'feat', heading: 'New Features' },
  { type: 'fix', heading: 'Bug Fixes' },
  { type: 'refactor', heading: 'Refactoring' },
  { type: 'docs', heading: 'Documentation' },
  { type: 'chore', heading: 'Maintenance' },
  { type: 'test', heading: 'Tests' },
  { type: 'style', heading: 'Style' },
];

function run(cmd) {
  return execSync(cmd, { encoding: 'utf-8' }).trim();
}

function findPreviousTag(currentTag) {
  const tags = run('git tag -l --sort=-version:refname').split('\n').filter(Boolean);
  const idx = tags.indexOf(currentTag);
  // Return the next tag in descending order, or null if this is the first
  return idx >= 0 && idx + 1 < tags.length ? tags[idx + 1] : null;
}

function getCommits(from, to) {
  const range = from ? `${from}..${to}` : to;
  const log = run(`git log ${range} --pretty=format:"%h %s"`);
  if (!log) return [];
  return log.split('\n').map((line) => {
    const hash = line.slice(0, 7);
    const subject = line.slice(8);
    return { hash, subject };
  });
}

function categorize(commits) {
  const grouped = Object.fromEntries(CATEGORIES.map((c) => [c.type, []]));
  const uncategorized = [];

  for (const commit of commits) {
    const match = commit.subject.match(/^(\w+):\s*(.+)/);
    if (match && grouped[match[1]]) {
      grouped[match[1]].push({ ...commit, description: match[2] });
    } else {
      uncategorized.push(commit);
    }
  }

  return { grouped, uncategorized };
}

function formatChangelog(tag, previousTag, grouped, uncategorized) {
  const lines = [];
  const range = previousTag ? `${previousTag}...${tag}` : tag;
  lines.push(`Changes since ${previousTag ?? 'initial commit'}\n`);

  for (const { type, heading } of CATEGORIES) {
    const entries = grouped[type];
    if (entries.length === 0) continue;
    lines.push(`## ${heading}\n`);
    for (const { hash, description } of entries) {
      lines.push(`- ${description} (\`${hash}\`)`);
    }
    lines.push('');
  }

  if (uncategorized.length > 0) {
    lines.push('## Other\n');
    for (const { hash, subject } of uncategorized) {
      lines.push(`- ${subject} (\`${hash}\`)`);
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}

function main() {
  const tag = process.argv[2];
  if (!tag) {
    console.error('Usage: node scripts/changelog.mjs <tag>');
    process.exit(1);
  }

  const previousTag = findPreviousTag(tag);
  const commits = getCommits(previousTag, tag);

  if (commits.length === 0) {
    console.log('No changes.');
    process.exit(0);
  }

  // Exclude release commits from the changelog
  const filtered = commits.filter((c) => !c.subject.startsWith('chore: release '));
  const { grouped, uncategorized } = categorize(filtered);
  console.log(formatChangelog(tag, previousTag, grouped, uncategorized));
}

main();
