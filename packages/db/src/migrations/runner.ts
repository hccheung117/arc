/**
 * Migration runner for @arc/db
 *
 * Executes SQL migrations sequentially and tracks which migrations have been
 * applied. Ensures migrations are idempotent and wraps errors for proper
 * error handling in the Core layer.
 */

import type { IPlatformDatabase } from "@arc/platform/contracts/database.js";
import type { Migration } from "./definitions.js";
import { migrations } from "./definitions.js";
import { MigrationError } from "../db-errors.js";

type MigrationRow = { name: string };
type CountRow = { count: number };

/**
 * Retrieve the set of migrations that have already been applied.
 */
async function getAppliedMigrations(
  db: IPlatformDatabase
): Promise<Set<string>> {
  try {
    const result = await db.query<MigrationRow>(
      "SELECT name FROM migrations ORDER BY id ASC"
    );
    return new Set(result.rows.map((row) => row.name));
  } catch {
    // Table does not exist yet (first migration)
    return new Set();
  }
}

/**
 * Record that a migration has been successfully applied.
 */
async function recordMigration(
  db: IPlatformDatabase,
  name: string
): Promise<void> {
  const now = Date.now();
  await db.exec("INSERT INTO migrations (name, applied_at) VALUES (?, ?)", [
    name,
    now,
  ]);
}

/**
 * Apply a single migration within a transaction.
 */
async function applyMigration(
  db: IPlatformDatabase,
  migration: Migration
): Promise<void> {
  try {
    await db.transaction(async () => {
      await db.execScript(migration.sql);
      await recordMigration(db, migration.name);
    });
  } catch (error) {
    throw new MigrationError(
      `Failed to apply migration: ${migration.name}`,
      migration.name,
      error
    );
  }
}

/**
 * Run all pending migrations sequentially.
 *
 * @param db - The platform database instance
 * @returns The number of migrations applied
 * @throws MigrationError if any migration fails
 */
export async function runMigrations(db: IPlatformDatabase): Promise<number> {
  const applied = await getAppliedMigrations(db);
  let appliedCount = 0;

  for (const migration of migrations) {
    if (!applied.has(migration.name)) {
      console.log(`Applying migration: ${migration.name}`);
      await applyMigration(db, migration);
      appliedCount++;
    }
  }

  if (appliedCount > 0) {
    console.log(`Applied ${appliedCount} migration(s)`);
  } else {
    console.log("Database is up to date");
  }

  return appliedCount;
}

/**
 * Get the current schema version (number of applied migrations).
 *
 * @param db - The platform database instance
 * @returns The number of applied migrations
 */
export async function getSchemaVersion(db: IPlatformDatabase): Promise<number> {
  try {
    const result = await db.query<CountRow>(
      "SELECT COUNT(*) as count FROM migrations"
    );
    const value = result.rows[0]?.count ?? 0;
    return typeof value === "number" ? value : Number(value) || 0;
  } catch {
    return 0;
  }
}
