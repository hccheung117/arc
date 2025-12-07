#!/usr/bin/env node

/**
 * Release script for Arc desktop application.
 *
 * Usage: node scripts/release.mjs X.Y.Z
 *
 * Validates environment, updates version, commits, tags, and pushes.
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DESKTOP_ROOT = resolve(__dirname, '..');
const PACKAGE_JSON_PATH = resolve(DESKTOP_ROOT, 'package.json');

function run(cmd, options = {}) {
  return execSync(cmd, { encoding: 'utf-8', ...options }).trim();
}

function validateSemver(version) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`Invalid version: "${version}". Expected X.Y.Z`);
  }
}

function ensureCleanWorkingTree() {
  const status = run('git status --porcelain');
  if (status) {
    throw new Error('Working tree not clean. Commit or stash changes first.');
  }
}

function ensureMainBranch() {
  const branch = run('git rev-parse --abbrev-ref HEAD');
  if (branch !== 'main') {
    throw new Error(`Must be on main branch. Currently on: ${branch}`);
  }
}

function ensureUpToDate() {
  run('git fetch origin main', { stdio: 'inherit' });
  const local = run('git rev-parse HEAD');
  const remote = run('git rev-parse origin/main');
  if (local !== remote) {
    throw new Error('Local main is not up to date with origin/main.');
  }
}

function ensureTagDoesNotExist(version) {
  try {
    run(`git rev-parse v${version}`);
    throw new Error(`Tag v${version} already exists.`);
  } catch (e) {
    if (e.message.includes('already exists')) throw e;
    // Tag doesn't exist - this is expected
  }
}

function updatePackageVersion(version) {
  const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf-8'));
  pkg.version = version;
  writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`Updated apps/desktop/package.json to ${version}`);
}

function createCommitAndTag(version) {
  run(`git add "${PACKAGE_JSON_PATH}"`, { stdio: 'inherit' });
  run(`git commit -m "chore: release ${version}"`, { stdio: 'inherit' });
  run(`git tag v${version}`, { stdio: 'inherit' });
  console.log(`Created commit and tag v${version}`);
}

function pushToOrigin(version) {
  run('git push origin main', { stdio: 'inherit' });
  run(`git push origin v${version}`, { stdio: 'inherit' });
  console.log(`Pushed to origin`);
}

function main() {
  const version = process.argv[2];

  if (!version) {
    console.error('Usage: node scripts/release.mjs X.Y.Z');
    process.exit(1);
  }

  try {
    console.log(`\nPreparing release v${version}...\n`);

    validateSemver(version);
    ensureCleanWorkingTree();
    ensureMainBranch();
    ensureUpToDate();
    ensureTagDoesNotExist(version);

    updatePackageVersion(version);
    createCommitAndTag(version);
    pushToOrigin(version);

    console.log(`\nRelease v${version} pushed. GitHub Actions will build and publish.`);
  } catch (error) {
    console.error(`\nError: ${error.message}`);
    process.exit(1);
  }
}

main();
